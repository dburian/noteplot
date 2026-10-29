import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';

import { logger } from '../log.js';
import { createParser } from './parse_note.js';
import { ParsePool } from './pool.js';

/**
 * Below this many cache misses a batch is parsed on the main thread.
 *
 * Setting up MathJax and Shiki costs ~3s and parsing a note ~5-7ms after that,
 * and every worker pays the setup again. Measured on this machine: 135 notes
 * parse in 3.7s in-process and 4.2s on 4 workers; 1350 notes in 10.3s
 * in-process and 6.1s on 4 workers. So the pool only ever starts for a large
 * cold parse -- a first run, or after the cache is deleted.
 */
const PARSE_POOL_THRESHOLD = 300;

/** More workers than this only contend over the start-up; 8 measured no faster. */
const MAX_PARSE_WORKERS = 4;

/**
 * Attaches the note's dates -- from git or the filesystem, see `dates.js`.
 *
 * The fields of a record that are not a function of the file's bytes, which is
 * why they are attached here, after the cache, and never stored in it.
 *
 * @param {import('../types.js').ParsedRecord} record
 * @param {import('../dates.js').Dates} dates
 * @returns {import('../types.js').NoteRecord}
 */
function withDates(record, dates) {
  return { ...record, ...dates };
}

/**
 * Turns note paths into `NoteRecord`s: read, look up the cache, parse the
 * misses -- across worker threads when there are enough of them.
 */
export class NoteParser {
  /**
   * @param {{noteRoot: string, imgUrl: string}} config
   * @param {import('../cache.js').Cache} cache
   * @param {import('../dates.js').NoteDates} dates
   */
  constructor({ noteRoot, imgUrl }, cache, dates) {
    this.parserConfig = { noteRoot, imgUrl };
    this.cache = cache;
    this.dates = dates;
    /** Built on first use; a warm start may never need it. */
    this.inProcess = null;
  }

  /**
   * One bad note costs that note, not the batch: its failure is logged and
   * counted, and the others go through.
   *
   * @param {string[]} paths absolute
   * @returns {Promise<{records: import('../types.js').NoteRecord[], missing: string[], failures: number}>}
   */
  async parseAll(paths) {
    /** @type {import('../types.js').NoteRecord[]} */
    const records = [];
    /** Paths that vanished between the event and the read. @type {string[]} */
    const missing = [];
    /** @type {{absPath: string, source: string, key: string, stats: import('node:fs').Stats}[]} */
    const misses = [];
    let failures = 0;

    await Promise.all(
      paths.map(async (absPath) => {
        let bytes, stats;
        try {
          [bytes, stats] = await Promise.all([readFile(absPath), stat(absPath)]);
        } catch (error) {
          if (error.code == 'ENOENT') {
            missing.push(absPath);
          } else {
            logger.error(error, `Could not read ${absPath}.`);
            failures++;
          }
          return;
        }

        const key = this.cache.recordKey(absPath, bytes);
        const cached = await this.cache.getRecord(key);
        if (cached) {
          this._logWarnings(cached.warnings);
          records.push(withDates(cached.record, this.dates.get(absPath, stats)));
        } else {
          misses.push({ absPath, source: bytes.toString('utf8'), key, stats });
        }
      })
    );

    if (misses.length > 0) {
      const workers = Math.min(MAX_PARSE_WORKERS, os.availableParallelism() - 1);
      const usePool = misses.length >= PARSE_POOL_THRESHOLD && workers > 1;
      logger.info(
        `Parsing ${misses.length} notes (${paths.length - misses.length - missing.length} cached)` +
          (usePool ? ` on ${workers} threads.` : '.')
      );

      const pool = usePool ? new ParsePool(workers, this.parserConfig) : null;
      const parse = pool
        ? (absPath, source) => pool.parse(absPath, source)
        : (absPath, source) => this._parseInProcess(absPath, source);

      try {
        await Promise.all(
          misses.map(async ({ absPath, source, key, stats }) => {
            try {
              const entry = await parse(absPath, source);
              this._logWarnings(entry.warnings);
              records.push(withDates(entry.record, this.dates.get(absPath, stats)));
              await this.cache.putRecord(key, entry);
            } catch (error) {
              logger.error(error, `Could not parse ${absPath}.`);
              failures++;
            }
          })
        );
      } finally {
        await pool?.close();
      }
    }

    return { records, missing, failures };
  }

  /**
   * Pays MathJax's and Shiki's start-up now rather than on the first save: the
   * first note through a fresh parser takes ~3s, every later one milliseconds.
   * Parses a scratch document that touches both; nothing is read or written.
   */
  async warmUp() {
    const scratch = '# Warm-up\n\n$x^2$\n\n```js\nlet x = 1;\n```\n';
    await this._parseInProcess(`${this.parserConfig.noteRoot}/__warm_up__.md`, scratch);
  }

  _parseInProcess(absPath, source) {
    this.inProcess ??= createParser(this.parserConfig);
    return this.inProcess(absPath, source);
  }

  /** @param {string[]} warnings */
  _logWarnings(warnings) {
    for (const warning of warnings ?? []) logger.warn(warning);
  }
}
