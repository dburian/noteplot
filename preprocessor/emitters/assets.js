import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../log.js';

/**
 * Copies the images notes embed into `static/note_imgs/`.
 *
 * A copy is named after the **image's** path, not the referring note's, so two
 * notes embedding one file share it; a copy goes only when no note refers to it
 * any more (ISSUES.md A19). This keeps the set of destinations the whole corpus
 * refers to and diffs against the last one, rather than counting references --
 * there is no count to get wrong.
 *
 * Copies only what is missing or older than its source, so a warm start copies
 * nothing. An image edited in place is picked up on the next start, or the next
 * time a note embedding it is saved; image files are not watched.
 *
 * @returns {import('../types.js').Emitter}
 */
export function createAssetsEmitter() {
  /** dest → src, as of the last emit. @type {Map<string, string>} */
  let current = new Map();

  return {
    id: 'assets',
    deps: ['images'],

    async emit(corpus, changes, { config }) {
      /** @type {Map<string, string>} */
      const wanted = new Map();
      for (const record of corpus.records.values()) {
        for (const { src, dest } of record.images) wanted.set(dest, src);
      }

      await mkdir(config.imgSavePath, { recursive: true });

      // Every wanted image on a cold start; afterwards only those of notes
      // whose images moved -- an image some other note already had is in place.
      const touched = new Set(changes.cold ? wanted.keys() : []);
      for (const slug of [...changes.added, ...changes.changed.keys()]) {
        for (const { dest } of corpus.records.get(slug)?.images ?? []) touched.add(dest);
      }

      await Promise.all([
        ...[...touched].map((dest) =>
          copyIfStale(/** @type {string} */ (wanted.get(dest)), path.join(config.imgSavePath, dest))
        ),
        ...[...current.keys()]
          .filter((dest) => !wanted.has(dest))
          .map((dest) => {
            logger.debug(`Removing ${dest}.`);
            return rm(path.join(config.imgSavePath, dest), { force: true });
          })
      ]);

      current = wanted;
    },

    /**
     * Within a session the diff above keeps the directory right, but an image
     * dropped while the preprocessor was down is in nobody's `current`. Only
     * after a clean scan: after a failed one `current` is missing whatever the
     * failed notes refer to, and this would delete images still in use.
     */
    async afterColdScan(corpus, { config }) {
      const entries = await readdir(config.imgSavePath, { withFileTypes: true }).catch(() => []);
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && !current.has(entry.name))
          .map((entry) => {
            logger.info(`Removing orphaned image ${entry.name}.`);
            return rm(path.join(config.imgSavePath, entry.name), { force: true });
          })
      );
    }
  };
}

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyIfStale(src, dest) {
  try {
    const [from, to] = await Promise.all([stat(src), stat(dest).catch(() => null)]);
    if (to && to.size == from.size && to.mtimeMs >= from.mtimeMs) return;

    await copyFile(src, dest);
  } catch (error) {
    // A broken image reference costs that image, not the batch.
    logger.warn(`Could not copy image ${src}: ${error.message}`);
  }
}
