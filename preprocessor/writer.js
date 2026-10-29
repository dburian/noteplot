import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sha1 } from './cache.js';
import { logger } from './log.js';

const MANIFEST = 'manifest.json';

/**
 * The only thing that writes into the generated directory.
 *
 * - **Skips identical writes.** Vite reloads on every write it sees, and the
 *   old pipelines rewrote the graph and the search index on every batch,
 *   whatever had changed. Hashes of what is on disk are kept in the cache's
 *   manifest, so a warm start writes nothing at all for an unchanged
 *   collection.
 * - **Writes atomically** -- to a temporary name, then renamed -- so vite never
 *   reads half a file.
 * - **Removes what a startup scan did not produce** (`pruneUnemitted`), which is
 *   how the JSON of a note deleted while the preprocessor was down goes away.
 */
export class ArtifactWriter {
  /**
   * @param {string} outDir
   * @param {import('./cache.js').Cache} cache
   */
  constructor(outDir, cache) {
    this.outDir = outDir;
    this.cache = cache;
    /** relPath → hash of the contents on disk. @type {Record<string, string>} */
    this.manifest = {};
    /** Files written or confirmed this process. @type {Set<string>} */
    this.emitted = new Set();
    /** Files whose manifest entry has been checked against the disk. @type {Set<string>} */
    this.verified = new Set();
    this.dirty = false;
  }

  async init() {
    this.manifest = (await this.cache.readJSON(MANIFEST)) ?? {};
  }

  /**
   * @param {string} rel path under `outDir`, `/`-separated
   * @param {unknown} data serialised as JSON
   * @returns {Promise<boolean>} whether the file was actually written
   */
  async write(rel, data) {
    const json = JSON.stringify(data);
    const hash = sha1(json);
    const target = path.join(this.outDir, rel);
    this.emitted.add(rel);

    // The manifest is only trusted once per file per process: the generated
    // directory can be deleted under a cache that survives it.
    if (this.manifest[rel] === hash) {
      if (this.verified.has(rel)) return false;
      this.verified.add(rel);
      if (await exists(target)) return false;
    }

    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, json, 'utf8');
    await rename(tmp, target);
    logger.debug(`Wrote ${rel}.`);

    this.manifest[rel] = hash;
    this.verified.add(rel);
    this.dirty = true;
    return true;
  }

  /** @param {string} rel */
  async remove(rel) {
    this.emitted.delete(rel);
    delete this.manifest[rel];
    this.dirty = true;
    await rm(path.join(this.outDir, rel), { force: true });
    logger.debug(`Removed ${rel}.`);
  }

  /**
   * Deletes every `.json` under `outDir` that nothing wrote this process. Only
   * meaningful after a startup scan that every note made it through: after a
   * partial one it would delete the output of notes that merely failed.
   */
  async pruneUnemitted() {
    const entries = await readdir(this.outDir, { recursive: true, withFileTypes: true }).catch(
      () => []
    );
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      const rel = path
        .relative(this.outDir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/');
      if (this.emitted.has(rel)) continue;

      logger.info(`Removing stale ${rel}.`);
      await this.remove(rel);
    }
  }

  /** Persists the manifest. Called once per batch. */
  async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    await this.cache.writeJSON(MANIFEST, this.manifest);
  }
}

/** @param {string} target */
async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
