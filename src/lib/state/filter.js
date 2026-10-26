import { writable } from 'svelte/store';

import { parseSearchString } from '../search/query.js';
import { getSearchClient } from '../search/search_client.js';

/**
 * @typedef {{
 *   text: string,
 *   query: import('../search/query.js').ParsedQuery | null,
 *   results: import('../search/search_client.js').Match[] | null,
 * }} FilterState
 * `text` is what was typed — what `?filter=` carries. `query` and `results`
 * are its outcome, and lag `text` while a search is in flight.
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<FilterState>['subscribe'],
 *   apply: (text: string) => Promise<{snippets: import('../search/search_client.js').Snippets} | null>,
 *   clear: () => void,
 * }} FilterStore
 */

/**
 * Which notes the visualization is restricted to.
 *
 * It runs its own search, rather than being handed results, because two
 * places apply a filter: the filter overlay, and `?filter=` on a URL (first
 * load, back/forward) with no overlay open at all. One `apply` means one
 * "newest run wins" counter between them.
 *
 * @param {import('./notes_index.js').NotesIndex} notesIndex
 * @returns {FilterStore}
 */
export function createFilterState(notesIndex) {
  const { subscribe, update } = writable(
    /** @type {FilterState} */ ({ text: '', query: null, results: null })
  );

  let latest = 0;

  function clear() {
    latest += 1;
    update((values) =>
      values.text === '' && values.query === null && values.results === null
        ? values
        : { text: '', query: null, results: null }
    );
  }

  /**
   * Filter by `text`; empty text clears. Resolves with the snippets of the
   * first page of matches, for the overlay's preview — or `null` when a newer
   * `apply` or a `clear` overtook this one. Rejects if the search fails.
   *
   * `text` is written **at once**, before the search: the URL is written from
   * it, and a `?filter=` being applied on first load must not be stripped from
   * the address bar while its search is still running.
   *
   * The outcome is **one** write of `query` and `results`, never two: the
   * separate `setQuery` / `setResults` pair this replaced made the graph
   * rebuild its filtered maps and redraw twice per keystroke (ISSUES.md C11).
   * `CanvasGraph.onFilterChange` early-returns on an unchanged `results`
   * reference, which only helps if there is one write.
   *
   * @param {string} text
   */
  async function apply(text) {
    const parsed = parseSearchString(text);
    if (!parsed) {
      clear();
      return null;
    }

    const mine = ++latest;
    update((values) => (values.text === text ? values : { ...values, text }));

    const found = await getSearchClient(notesIndex).search(parsed);
    if (mine !== latest) return null;

    update((values) => ({ ...values, query: parsed, results: found.matches }));
    return { snippets: found.snippets };
  }

  return { subscribe, apply, clear };
}
