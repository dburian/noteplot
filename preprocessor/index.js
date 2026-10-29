import { mkdir } from 'node:fs/promises';

import { Cache } from './cache.js';
import { Corpus, isAffected } from './corpus.js';
import { NoteDates } from './dates.js';
import { createEmitters } from './emitters/index.js';
import { logger } from './log.js';
import { NoteParser } from './parse/index.js';
import { NoteScanner } from './scan.js';
import { toSlug } from './slug.js';
import { ArtifactWriter } from './writer.js';

/**
 * How long the watcher waits for a burst of saves to end. `watcher` already
 * coalesces inside its own 300ms window, so this only has to outlast an editor
 * writing a swap file and the note in quick succession.
 */
const DEFAULT_WATCH_DEBOUNCE = 200;

/**
 * Runs every emitter over the note tree once, then optionally keeps watching.
 *
 * Returns the number of notes that made it through, which `index.js` uses to
 * refuse a build of an empty collection (ISSUES.md A18).
 *
 * @param {import('./types.js').PreprocessConfig} config
 * @returns {Promise<number>}
 */
export async function preprocess(config) {
  const preprocessor = new Preprocessor(config);
  await preprocessor.init();

  const noteCount = await preprocessor.scanAll();

  if (config.watch) preprocessor.watch();

  return noteCount;
}

/**
 * The orchestrator. One batch is:
 *
 *   paths ─▶ NoteParser ─▶ records ─▶ Corpus.apply ─▶ ChangeSet ─▶ emitters
 *
 * and nothing here knows what any emitter produces.
 */
class Preprocessor {
  /** @param {import('./types.js').PreprocessConfig} config */
  constructor(config) {
    this.config = config;
    this.cache = new Cache(config.cachePath, config);
    this.writer = new ArtifactWriter(config.savePath, this.cache);
    this.dates = new NoteDates(config.noteRoot);
    this.parser = new NoteParser(config, this.cache, this.dates);
    this.corpus = new Corpus();
    this.emitters = createEmitters();
    this.scanner = new NoteScanner(config.noteRoot, {
      debounce: config.watchDebounce ?? DEFAULT_WATCH_DEBOUNCE
    });
  }

  async init() {
    await mkdir(this.config.savePath, { recursive: true });
    await this.cache.init();
    await this.writer.init();
  }

  async scanAll() {
    const started = performance.now();
    const paths = await this.scanner.listNotes();
    await this.dates.load(paths);

    const { failures } = await this.process({ upserts: paths, removals: [], cold: true });

    // Sweeps that delete whatever the corpus does not account for. Only after
    // a clean scan: after a failure the corpus is missing the notes that
    // failed, and these would delete their output.
    if (failures == 0) {
      await this.writer.pruneUnemitted();
      await Promise.all(
        this.emitters.map((emitter) => emitter.afterColdScan?.(this.corpus, this.context()))
      );
      await this.cache.pruneRecords();
      await this.writer.flush();
    } else {
      logger.warn(`${failures} notes failed; skipping the stale-output sweep.`);
    }

    logger.info(
      `Processed ${this.corpus.records.size} notes in ${(performance.now() - started).toFixed(0)}ms.`
    );
    return this.corpus.records.size;
  }

  watch() {
    const watcher = this.scanner.watch(async (events) => {
      // The watcher calls this from a timer, where a rejection would become an
      // unhandled rejection and take the whole process down.
      try {
        const upserts = events.filter((e) => e.eventType != 'unlink').map((e) => e.targetPath);
        // A saved note is now dirty, so its `accessed` becomes its mtime.
        await this.dates
          .refresh(upserts)
          .catch((error) => logger.warn(`Could not ask git which notes changed: ${error.message}`));
        await this.process({
          upserts,
          removals: events.filter((e) => e.eventType == 'unlink').map((e) => e.targetPath),
          cold: false
        });
      } catch (error) {
        logger.error(error, 'Failed to process a batch of note changes.');
      }
    });

    // Only once the watcher is listening. The warm-up holds the event loop for
    // seconds, and before `ready` that is time in which `watcher` has not yet
    // subscribed -- a save made then was never seen at all.
    watcher.once('ready', () => {
      this.parser
        .warmUp()
        .catch((error) => logger.warn(`Could not warm up the parser: ${error.message}`));
    });
  }

  /**
   * @param {{upserts: string[], removals: string[], cold: boolean}} batch absolute paths
   * @returns {Promise<{failures: number}>}
   */
  async process({ upserts, removals, cold }) {
    const { records, missing, failures } = await this.parser.parseAll(upserts);

    const changes = this.corpus.apply({
      upserts: records,
      // A file that vanished between its event and the read is a removal.
      removals: [...removals, ...missing].map((p) => toSlug(p, this.config.noteRoot)),
      cold
    });

    const affected = this.emitters.filter((emitter) => isAffected(emitter, changes));
    logger.debug(
      `Batch: +${changes.added.size} ~${changes.changed.size} -${changes.removed.size}; ` +
        `running ${affected.map((e) => e.id).join(', ') || 'nothing'}.`
    );

    const results = await Promise.allSettled(
      affected.map((emitter) => emitter.emit(this.corpus, changes, this.context()))
    );
    let emitFailures = 0;
    results.forEach((result, i) => {
      if (result.status == 'rejected') {
        emitFailures++;
        logger.error(result.reason, `Emitter ${affected[i].id} failed.`);
      }
    });

    await this.writer.flush();
    return { failures: failures + emitFailures };
  }

  /** @returns {import('./types.js').EmitContext} */
  context() {
    return { writer: this.writer, cache: this.cache, config: this.config };
  }
}
