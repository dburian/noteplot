/**
 * The generated data of every visualization, by `dataId`: one file per graph
 * emitter in the preprocessor, `src/lib/generated/viz/<dataId>.json`.
 *
 * Lazy, like the notes glob in `notes_route.js` -- each file is its own chunk
 * and only the active visualization's is fetched (ISSUES.md B2). The graph used
 * to be loaded by `(app)/+layout.js` for every page whether or not anything
 * drew it.
 */
const vizModules = /** @type {Record<string, () => Promise<{default: any}>>} */ (
  import.meta.glob('$lib/generated/viz/*.json')
);

/** @type {Map<string, () => Promise<{default: any}>>} */
const loaders = new Map();
for (const [filePath, loadModule] of Object.entries(vizModules)) {
  loaders.set(filePath.slice(filePath.lastIndexOf('/') + 1, -'.json'.length), loadModule);
}

/** @type {Map<string, any>} */
const cache = new Map();

/**
 * The data if it is already loaded, else the promise for it -- the same
 * contract as `getNote`, for the same reason: `VizPane` renders this inside an
 * `{#await}`, which tears its then-branch down whenever the expression yields a
 * new promise. A stable reference per id keeps the canvas from being rebuilt.
 *
 * A missing file is a rejected promise, never a throw: this runs in a template.
 *
 * @param {string} dataId
 * @returns {any | Promise<any>}
 */
export function getVizData(dataId) {
  if (cache.has(dataId)) return cache.get(dataId);

  const loadModule = loaders.get(dataId);
  if (!loadModule) return Promise.reject(new Error(`No generated data for ${dataId}.`));

  const pending = loadModule().then(
    (module) => {
      cache.set(dataId, module.default);
      return module.default;
    },
    (err) => {
      cache.delete(dataId);
      throw err;
    }
  );
  cache.set(dataId, pending);
  return pending;
}
