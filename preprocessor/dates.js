import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { logger } from './log.js';

const execFileAsync = promisify(execFile);

/** @typedef {{created: number, accessed: number, dateSource: 'git' | 'fs'}} Dates */

/**
 * Every note's `created` and `accessed` dates, from git when the note is
 * tracked, from the filesystem otherwise. Frontmatter is not consulted.
 *
 * - git: `created` is the first commit touching the note (following renames),
 *   `accessed` the last -- or the file's mtime while it has uncommitted edits.
 * - fs: `created` is the birthtime where the filesystem has one, else the
 *   mtime; `accessed` is the mtime. atime is deliberately not used: relatime
 *   and noatime mounts leave it stale, and reading the note bumps it.
 *
 * The history is read once per startup, by one `git log` over the note root.
 * During `watch`, `refresh` only re-reads which notes are dirty; a commit made
 * while watching is picked up on the next start.
 *
 * Dates depend on more than a note's bytes, so `NoteParser` attaches them after
 * the record cache, like nothing else in a record.
 */
export class NoteDates {
  /** @param {string} noteRoot absolute */
  constructor(noteRoot) {
    this.noteRoot = noteRoot;
    /** The repository's top level, or `null` outside git. @type {string | null} */
    this.top = null;
    /** The note root with symlinks resolved, as git sees it. */
    this.realRoot = noteRoot;
    /** git path (relative to `top`, `/`-separated) → commit times in ms. @type {Map<string, {first: number, last: number}>} */
    this.commits = new Map();
    /** git paths of tracked notes with uncommitted changes. @type {Set<string>} */
    this.dirty = new Set();
  }

  /**
   * Reads the history of every note in `notes`. Without git -- not installed,
   * or the root is outside a repository -- every note gets filesystem dates.
   *
   * @param {string[]} notes absolute
   */
  async load(notes) {
    try {
      this.top = (await git(this.noteRoot, ['rev-parse', '--show-toplevel'])).trim();
    } catch {
      logger.info(
        `${this.noteRoot} is not in a git repository (or git is not installed); note dates come from the filesystem.`
      );
      return;
    }
    try {
      // git reports paths relative to the real top level; the note root may
      // have been reached through a symlink.
      this.realRoot = await realpath(this.noteRoot);

      if ((await git(this.top, ['rev-parse', '--is-shallow-repository'])).trim() == 'true') {
        logger.warn(
          `${this.top} is a shallow clone; notes older than its history get the oldest commit it has as their \`created\` date.`
        );
      }

      const [log] = await Promise.all([
        git(this.top, [
          'log',
          '-z',
          '-M',
          '--name-status',
          '--format=%x00%at',
          '--',
          this._rootSpec()
        ]),
        this.refresh(notes)
      ]);
      this._readLog(log, notes);
    } catch (error) {
      logger.warn(
        `Could not read the git history of ${this.noteRoot} (${error.message}); note dates come from the filesystem.`
      );
      this.top = null;
      this.commits.clear();
    }
  }

  /**
   * Re-reads which of `notes` have uncommitted changes. Run on every watch
   * batch, so a note saved but not committed has its mtime as `accessed`.
   *
   * @param {string[]} notes absolute
   */
  async refresh(notes) {
    if (this.top === null || notes.length == 0) return;
    const paths = notes.map((note) => this._gitPath(note));
    // A watch batch names its few notes; anything bigger -- the startup scan --
    // asks about the whole root, which also keeps the command line under every
    // OS's length limit.
    const spec = paths.length <= 100 ? paths.map((p) => `:(literal)${p}`) : [this._rootSpec()];
    const stdout = await git(this.top, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=no',
      '--',
      ...spec
    ]);

    for (const p of paths) this.dirty.delete(p);
    // `XY path\0`; a rename or copy adds its old path as one more entry.
    const entries = stdout.split('\0');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.length < 4) continue;
      this.dirty.add(entry.slice(3));
      if (entry[0] == 'R' || entry[0] == 'C') i++;
    }
  }

  /**
   * @param {string} absPath
   * @param {import('node:fs').Stats} stats
   * @returns {Dates}
   */
  get(absPath, stats) {
    const { mtimeMs, birthtimeMs } = stats;
    const commits = this.top === null ? undefined : this.commits.get(this._gitPath(absPath));
    if (commits) {
      const dirty = this.dirty.has(this._gitPath(absPath));
      return {
        created: commits.first,
        accessed: dirty ? mtimeMs : commits.last,
        dateSource: 'git'
      };
    }
    // Filesystems without a birthtime report 0 or the ctime instead; a
    // birthtime after the mtime is one of those, or a copy that kept its mtime.
    const born = birthtimeMs > 0 && birthtimeMs <= mtimeMs ? birthtimeMs : mtimeMs;
    return { created: born, accessed: mtimeMs, dateSource: 'fs' };
  }

  /**
   * Walks `git log --name-status` from the newest commit back. A rename points
   * the old name at the note it became, so the note's history continues past
   * it. Dates are min/max rather than first/last seen: author dates need not be
   * in order after a rebase.
   *
   * @param {string} stdout
   * @param {string[]} notes absolute
   */
  _readLog(stdout, notes) {
    /** Historical git path → the git path of the note it is now. @type {Map<string, string>} */
    const current = new Map(notes.map((note) => [this._gitPath(note), this._gitPath(note)]));

    /**
     * @param {string} historical
     * @param {number} ms
     */
    const see = (historical, ms) => {
      const note = current.get(historical);
      if (note === undefined) return;
      const entry = this.commits.get(note);
      if (entry) {
        entry.first = Math.min(entry.first, ms);
        entry.last = Math.max(entry.last, ms);
      } else {
        this.commits.set(note, { first: ms, last: ms });
      }
    };

    // Each commit is `\0<unix seconds>\0` followed by `<status>\0<path>\0`
    // entries, two paths for a rename or copy. The first status of a commit
    // carries a leading `\n`.
    const tokens = stdout.split('\0');
    let ms = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].replace(/^\n/, '');
      if (token == '') {
        if (i + 1 < tokens.length) ms = Number(tokens[++i]) * 1000;
        continue;
      }
      if (token[0] == 'R' || token[0] == 'C') {
        const [from, to] = [tokens[++i], tokens[++i]];
        see(to, ms);
        const note = current.get(to);
        if (token[0] == 'R' && note !== undefined) current.set(from, note);
      } else {
        see(tokens[++i], ms);
      }
    }
  }

  /**
   * A note's path as git prints it: relative to the top level, `/`-separated
   * whatever the OS.
   *
   * @param {string} absPath
   */
  _gitPath(absPath) {
    const real = path.join(this.realRoot, path.relative(this.noteRoot, absPath));
    return path
      .relative(/** @type {string} */ (this.top), real)
      .split(path.sep)
      .join('/');
  }

  _rootSpec() {
    const rel = path.relative(/** @type {string} */ (this.top), this.realRoot);
    return rel == '' ? '.' : `:(literal)${rel.split(path.sep).join('/')}`;
  }
}

/**
 * @param {string} cwd
 * @param {string[]} args
 */
async function git(cwd, args) {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', cwd, '-c', 'core.quotePath=false', ...args],
    {
      maxBuffer: 1024 * 1024 * 1024
    }
  );
  return stdout;
}
