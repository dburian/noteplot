import { writable } from 'svelte/store';

/**
 * @typedef {{
 *   query: import('minisearch').Query | null,
 *   results: import('../search/search_index').Match[] | null,
 * }} FilterState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<FilterState>['subscribe'],
 *   setQueryAndResults: (
 *     query: import('minisearch').Query,
 *     results: import('../search/search_index').Match[]
 *   ) => void,
 *   clear: () => void,
 * }} FilterStore
 */

/**
 * Which notes the visualization is restricted to. Moved here verbatim from
 * `search/WithFilterContext.svelte`.
 *
 * @returns {FilterStore}
 */
export function createFilterState() {
  const { subscribe, update } = writable(
    /** @type {FilterState} */ ({ query: null, results: null })
  );

  /**
   * The only way to write a query's outcome, and deliberately a single call:
   * the separate `setQuery` / `setResults` pair it replaced made the graph
   * rebuild its filtered maps and redraw twice per keystroke (ISSUES.md C11).
   * `CanvasGraph.onFilterChange` early-returns on an unchanged `results`
   * reference, which only helps if there is one write.
   *
   * @param {import('minisearch').Query} query
   * @param {import('../search/search_index').Match[]} results
   */
  function setQueryAndResults(query, results) {
    update((values) => ({ ...values, query, results }));
  }

  function clear() {
    update((values) =>
      values.query === null && values.results === null
        ? values
        : { ...values, query: null, results: null }
    );
  }

  return { subscribe, setQueryAndResults, clear };
}
