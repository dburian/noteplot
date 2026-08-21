import { loadSearchNotes } from '$lib/notes_route.js';

/**
 * The built search index, fetched and constructed on first use.
 *
 * Both halves are deliberately lazy. `__search.json` is the plaintext of every
 * note (ISSUES.md B2), and `search_index.js` pulls in `minisearch` — neither is
 * wanted by a visitor who never opens an overlay, and the overlays are mounted
 * by `(app)/+layout.svelte`, whose chunk loads on **every** page. A static
 * import of either would move both into it.
 *
 * Memoised on the promise, so the two overlays and any number of opens share
 * one index. That matters twice over: `getSearchIndex` also memoises, on the
 * notes array's identity, and `loadSearchNotes` returns the same promise every
 * call — so all three layers agree there is exactly one index.
 *
 * @type {Promise<import('./search_index.js').MiniSearchIndex> | null}
 */
let indexPromise = null;

/** @returns {Promise<import('./search_index.js').MiniSearchIndex>} */
export function loadSearchIndex() {
  if (!indexPromise) {
    indexPromise = Promise.all([import('./search_index.js'), loadSearchNotes()]).then(
      // The array is passed **untouched**; a copy or a spread defeats
      // `getSearchIndex`'s memo and re-indexes the corpus (ISSUES.md B3).
      ([{ getSearchIndex }, notes]) => getSearchIndex(notes)
    );
  }

  return indexPromise;
}
