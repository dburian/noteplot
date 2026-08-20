<script>
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  /**
   * @typedef {{
   *   query: import('minisearch').Query | null,
   *   results: import('./search_index').Match[] | null,
   * }} FilterState
   */

  function createFilterState() {
    /** @type {import('svelte/store').Writable<FilterState>} */
    const { subscribe, update } = writable({ query: null, results: null });

    /**
     * The only way to write a query's outcome, and deliberately a single call:
     * the separate `setQuery` / `setResults` it replaces made the graph
     * rebuild its filtered maps and redraw twice per keystroke (ISSUES.md
     * C11).
     *
     * @param {import('minisearch').Query} query
     * @param {import('./search_index').Match[]} results
     */
    const setQueryAndResults = (query, results) => {
      update((values) => ({ ...values, query, results }));
    };

    const clear = () => {
      update((values) => ({...values, query: null, results: null}))
    }

    return {
      subscribe,
      setQueryAndResults,
      clear,
      update
    };
  }

  const filterContext = createFilterState();

  setContext('filterState', filterContext);
</script>

<slot />
