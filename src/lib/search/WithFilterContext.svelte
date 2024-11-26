<script>
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  function createFilterState() {
    const { subscribe, update } = writable({ query: null, results: null });

    const setQuery = (query) => {
      update((values) => ({ ...values, query }));
    };

    const setResults = (results) => {
      update((values) => ({ ...values, results }));
    };

    const clear = () => {
      update((values) => ({...values, query: null, results: null}))
    }

    return {
      subscribe,
      setQuery,
      setResults,
      clear,
      update
    };
  }

  const filterContext = createFilterState();

  setContext('filterState', filterContext);
</script>

<slot />
