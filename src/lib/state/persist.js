/**
 * Storage helpers with the two guards every caller needs.
 *
 * 1. `typeof window !== 'undefined'` — these modules are imported during
 *    prerender, where there is no `sessionStorage`/`localStorage`. Since
 *    `Adaptive` no longer gates the component tree, code in this directory
 *    really does run on the server.
 * 2. try/catch — storage throws in private-mode Safari and when the quota is
 *    full. A persisted preference is never worth breaking the app for.
 */

/**
 * @param {'local'|'session'} which
 * @returns {Storage | null}
 */
function storage(which) {
  if (typeof window === 'undefined') return null;
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {'local'|'session'} which
 * @param {string} key
 * @param {T} fallback returned on any miss, parse failure, or storage error
 * @returns {T}
 */
export function readStored(which, key, fallback) {
  const store = storage(which);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {'local'|'session'} which
 * @param {string} key
 * @param {unknown} value
 */
export function writeStored(which, key, value) {
  const store = storage(which);
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — persisting is best-effort */
  }
}
