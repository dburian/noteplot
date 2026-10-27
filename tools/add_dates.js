import { execFile } from 'node:child_process';
import { readFile, realpath, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { VFile } from 'vfile';
import { matter } from 'vfile-matter';

import { logger } from '../preprocessor/log.js';
import { parseCreated } from '../preprocessor/parse/plugins.js';
import { NoteScanner } from '../preprocessor/scan.js';
import { toDisplayPath } from '../preprocessor/slug.js';

/*
 * `noteplot add-dates`: writes `created` and `accessed` into every note's
 * frontmatter, as `YYYY-MM-DD` -- the form `parseCreated` accepts and the date
 * graph places notes by. Not part of the preprocessor: it edits the user's
 * notes, which nothing else in noteplot ever does.
 *
 * `created` is the day of the commit that first added the note (following
 * renames), `accessed` the day of the last commit touching it. A note git does
 * not know about -- or a collection outside any repository -- gets its mtime's
 * day for both.
 */

const execFileAsync = promisify(execFile);

/** @typedef {'warn' | 'fix' | 'set'} Mode */
/** @typedef {{created: string, accessed: string}} NoteDates */

const KEYS = /** @type {const} */ (['created', 'accessed']);

// The block `vfile-matter` recognises, so we edit exactly what the parser reads.
const FRONTMATTER = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/;

/**
 * @param {{noteRoot: string, mode: Mode, dryRun: boolean}} opts
 */
export async function addDates({ noteRoot, mode, dryRun }) {
  const notes = await new NoteScanner(noteRoot, { debounce: 0 }).listNotes();
  const gitDates = await readGitDates(noteRoot, notes);

  let changed = 0;
  let warnings = 0;
  for (const notePath of notes) {
    const result = await processNote(notePath, gitDates.get(notePath), { noteRoot, mode, dryRun });
    if (result.changed) changed++;
    warnings += result.warnings;
  }

  logger.info(
    `${notes.length} notes scanned, ${changed} ${dryRun ? 'would change' : 'changed'}, ${warnings} warnings.` +
      (dryRun ? ' Dry run -- nothing written.' : '')
  );

  // pino's transport runs in a thread, and a burst of lines followed by exit
  // otherwise loses the tail -- the summary included.
  await new Promise((resolve) => logger.flush(resolve));
}

/**
 * @param {string} notePath
 * @param {NoteDates | undefined} gitDates
 * @param {{noteRoot: string, mode: Mode, dryRun: boolean}} opts
 * @returns {Promise<{changed: boolean, warnings: number}>}
 */
async function processNote(notePath, gitDates, { noteRoot, mode, dryRun }) {
  const displayPath = toDisplayPath(notePath, noteRoot);
  const [text, stats] = await Promise.all([readFile(notePath, 'utf8'), stat(notePath)]);
  const source = gitDates ? 'git' : 'mtime';
  const day = localDayString(stats.mtimeMs);
  const computed = gitDates ?? { created: day, accessed: day };

  /** @type {Record<string, unknown>} */
  let current = {};
  try {
    // `matter` throws on an empty block (`---\n---`), which has nothing to read.
    if (FRONTMATTER.exec(text)?.[1]) {
      const file = new VFile({ path: notePath, value: text });
      matter(file);
      current = /** @type {Record<string, unknown>} */ (file.data.matter) || {};
    }
  } catch (error) {
    logger.warn(`${displayPath}: could not parse its frontmatter (${error.message}); skipped.`);
    return { changed: false, warnings: 1 };
  }

  /** @type {Partial<NoteDates>} */
  const updates = {};
  let warnings = 0;
  for (const key of KEYS) {
    const value = current[key];
    const ms = parseCreated(value);
    const existing = ms === null ? null : new Date(ms).toISOString().slice(0, 10);

    let reason = null;
    if (value === undefined) reason = 'missing';
    else if (mode == 'set' && existing != computed[key]) reason = 'set';
    else if (existing === null) {
      if (mode == 'fix') reason = 'malformed';
      else {
        logger.warn(`${displayPath}: ${key} is malformed (${JSON.stringify(value)}).`);
        warnings++;
      }
    } else if (existing != computed[key]) {
      logger.warn(`${displayPath}: ${key} is ${existing} but ${source} says ${computed[key]}.`);
      warnings++;
    }

    if (reason) {
      updates[key] = computed[key];
      const old = value === undefined ? '(none)' : JSON.stringify(value);
      logger.info(`${displayPath}: ${key} ${old} -> ${computed[key]} (${reason})`);
    }
  }

  if (Object.keys(updates).length == 0) return { changed: false, warnings };

  if (!dryRun) {
    await writeFile(notePath, applyUpdates(text, updates));
    // Keep the mtime: the edit is bookkeeping, not a change to the note, and an
    // untracked note's dates are read from it.
    await utimes(notePath, stats.atime, stats.mtime);
  }
  return { changed: true, warnings };
}

/**
 * Rewrites the frontmatter's top-level `created` / `accessed` lines in place,
 * appends the missing ones before its closing `---`, and creates the block if
 * there is none. Edits text rather than re-serialising the YAML, so comments,
 * quoting and key order elsewhere in the block survive.
 *
 * @param {string} text
 * @param {Partial<NoteDates>} updates
 */
function applyUpdates(text, updates) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FRONTMATTER.exec(text);

  if (!match) {
    const lines = Object.entries(updates).map(([key, value]) => `${key}: ${value}`);
    return ['---', ...lines, '---', '', ''].join(eol) + text;
  }

  let body = match[1] ?? '';
  const appended = [];
  for (const [key, value] of Object.entries(updates)) {
    const line = new RegExp(`^${key}:.*$`, 'm');
    if (line.test(body)) body = body.replace(line, `${key}: ${value}`);
    else appended.push(`${key}: ${value}`);
  }
  const lines = body == '' ? appended : [body, ...appended];
  const block = ['---', ...lines, '---'].join(eol);

  // The closing `---`'s own line ending is part of the match; keep whatever it was.
  const closing = match[0].slice(match[0].lastIndexOf('---') + 3);
  return block + closing + text.slice(match[0].length);
}

/**
 * The first and last commit day of every note git knows about, from a single
 * `git log` over the note root -- one process per note would not scale to a
 * large collection.
 *
 * @param {string} noteRoot absolute
 * @param {string[]} notes absolute
 * @returns {Promise<Map<string, NoteDates>>} keyed by the paths in `notes`
 */
async function readGitDates(noteRoot, notes) {
  /** @type {Map<string, NoteDates>} */
  const dates = new Map();

  let top;
  try {
    const { stdout } = await execFileAsync('git', ['-C', noteRoot, 'rev-parse', '--show-toplevel']);
    top = stdout.trim();
  } catch {
    logger.info(`${noteRoot} is not in a git repository; every date comes from mtime.`);
    return dates;
  }

  // git reports paths relative to the real top level; the note root may have
  // been reached through a symlink.
  const realRoot = await realpath(noteRoot);
  const { stdout } = await execFileAsync(
    'git',
    [
      '-C',
      top,
      '-c',
      'core.quotePath=false',
      'log',
      '-z',
      '-M',
      '--name-status',
      '--format=%x00%as',
      '--',
      path.relative(top, realRoot) || '.'
    ],
    { maxBuffer: 1024 * 1024 * 1024 }
  );

  // Historical path (relative to `top`) -> the note it is now. Walking from the
  // newest commit back, a rename points the old name at the current note.
  /** @type {Map<string, string>} */
  const current = new Map(
    notes.map((note) => [
      path.relative(top, path.join(realRoot, path.relative(noteRoot, note))),
      note
    ])
  );

  /**
   * @param {string} historical
   * @param {string} day
   */
  const see = (historical, day) => {
    const note = current.get(historical);
    if (!note) return;
    const entry = dates.get(note);
    if (entry) entry.created = day;
    else dates.set(note, { created: day, accessed: day });
  };

  // Each commit is `\0<day>\0` followed by `<status>\0<path>\0` entries, two
  // paths for a rename or copy. The first status of a commit carries a `\n`.
  const tokens = stdout.split('\0');
  let day = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/^\n/, '');
    if (token == '') {
      if (i + 1 < tokens.length) day = tokens[++i];
      continue;
    }
    if (token[0] == 'R' || token[0] == 'C') {
      const [from, to] = [tokens[++i], tokens[++i]];
      see(to, day);
      const note = current.get(to);
      if (token[0] == 'R' && note) current.set(from, note);
    } else {
      see(tokens[++i], day);
    }
  }
  return dates;
}

/**
 * The local calendar day of `ms`, as `YYYY-MM-DD` -- the day the author saw,
 * like the date graph's own mtime fallback.
 *
 * @param {number} ms
 */
function localDayString(ms) {
  const date = new Date(ms);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
