import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './log.js';

/**
 * Everything whose change makes a cached parse wrong. Hashed whole, so editing a
 * plugin or upgrading a dependency invalidates the record cache by itself --
 * there is no version number to remember to bump.
 */
const PARSER_SOURCES = [
  'parse/parse_note.js',
  'parse/plugins.js',
  'slug.js',
  '../package-lock.json'
];

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {...(string | Buffer)} parts
 */
export function sha1(...parts) {
  const hash = createHash('sha1');
  for (const part of parts) {
    hash.update(part);
    // A separator, so `('ab', 'c')` and `('a', 'bc')` do not collide.
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * The preprocessor's persistent state, under `.cache/noteplot/` in the package:
 *
 *   records/<key>.json     one parsed note, keyed by `recordKey`
 *   layout/<root>-<id>.json   a graph emitter's node positions, per collection
 *   manifest.json          the hash of every artifact last written
 *
 * All of it is disposable. Deleting the directory costs one slow start -- a full
 * parse and a full relayout -- and nothing else.
 */
export class Cache {
  /**
   * @param {string} dir
   * @param {{noteRoot: string, imgUrl: string}} config
   */
  constructor(dir, { noteRoot, imgUrl }) {
    this.dir = dir;
    this.recordsDir = path.join(dir, 'records');
    this.config = { noteRoot, imgUrl };
    /** @type {string} */
    this.fingerprint = '';
    /** Every record key looked up or stored this process. @type {Set<string>} */
    this.usedKeys = new Set();
  }

  async init() {
    await mkdir(this.recordsDir, { recursive: true });
    await mkdir(path.join(this.dir, 'layout'), { recursive: true });

    const sources = await Promise.all(
      PARSER_SOURCES.map((rel) => readFile(path.join(here, rel)).catch(() => Buffer.from(rel)))
    );
    // `imgUrl` is baked into every image's URL in the HTML, so `--base-path`
    // has to invalidate.
    this.fingerprint = sha1(JSON.stringify(this.config), ...sources);
  }

  /**
   * Where a graph emitter keeps its positions. Per note root: positions are
   * keyed by slug, and two collections can share slugs without sharing
   * anything else -- one would pin the other's nodes where they do not belong.
   *
   * @param {string} id
   */
  layoutFile(id) {
    return path.join('layout', `${sha1(this.config.noteRoot).slice(0, 12)}-${id}.json`);
  }

  /**
   * The cache key for one note: the parser's fingerprint, the note's path --
   * a note's slug and links are relative to where it lives, so the same bytes
   * moved elsewhere are a different record -- and its contents.
   *
   * @param {string} absPath
   * @param {Buffer} bytes
   */
  recordKey(absPath, bytes) {
    return sha1(this.fingerprint, absPath, bytes);
  }

  /**
   * @param {string} key
   * @returns {Promise<{record: import('./types.js').NoteRecord, warnings: string[]} | null>}
   */
  async getRecord(key) {
    this.usedKeys.add(key);
    return this.readJSON(path.join('records', `${key}.json`));
  }

  /**
   * @param {string} key
   * @param {{record: import('./types.js').NoteRecord, warnings: string[]}} entry
   */
  async putRecord(key, entry) {
    this.usedKeys.add(key);
    await this.writeJSON(path.join('records', `${key}.json`), entry);
  }

  /**
   * Deletes every cached record this process has not used. Called after a
   * clean startup scan, when every live note has been looked up -- anything
   * else is an old version of a note, or a note that is gone.
   */
  async pruneRecords() {
    const names = await readdir(this.recordsDir).catch(() => []);
    const stale = names.filter((name) => !this.usedKeys.has(path.basename(name, '.json')));
    await Promise.all(stale.map((name) => rm(path.join(this.recordsDir, name), { force: true })));
    if (stale.length) logger.debug(`Pruned ${stale.length} stale cache records.`);
  }

  /**
   * `null` for a missing or unreadable entry: a cache miss, never an error.
   *
   * @param {string} rel
   */
  async readJSON(rel) {
    try {
      return JSON.parse(await readFile(path.join(this.dir, rel), 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Write-then-rename, so a process killed mid-write leaves the old entry or
   * none -- never half of one, which `readJSON` would then have to distrust.
   *
   * @param {string} rel
   * @param {unknown} data
   */
  async writeJSON(rel, data) {
    const target = path.join(this.dir, rel);
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data), 'utf8');
    await rename(tmp, target);
  }
}
