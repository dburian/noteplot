<script>
  import SearchMatch from './SearchMatch.svelte';
  import { MiniSearchIndex } from './search_index.js';
  import SearchBar from './SearchBar.svelte';
  import QueryDisplay from './QueryDisplay.svelte';
  import { getContext } from 'svelte';

  export let notes;

  let searchString = '';
  /** @type {import('minisearch').Query} */
  let query;

  const index = new MiniSearchIndex(notes);
  let searching = false;

  /**
   * @type import('./search_index').Match[] | null */
  let results = null;

  /**
   * @param {string} searchString
   */
  function searchIndex(searchString) {
    searchString = searchString;
    query = index.parseSearchString(searchString);
    searching = true;
    results = index.search(query);
    searching = false;
  }
</script>

<div class="w-full p-4">
  <h5 class="text-4xl my-8 text-center">Search</h5>
  <SearchBar
    placeholder="Search notes"
    on:search={(event) => searchIndex(event.detail.searchString)}
    />
  <QueryDisplay {query} />
  {#if results !== null && results.length > 0}
    <section class="grid">
      {#each results as match, i (match.note.slug)}
        <SearchMatch {match} tabIndex={i} />
      {/each}
    </section>
  {:else if results !== null}
    <h2 class="text-3xl text-center my-8">no match</h2>
  {:else if query && ((typeof query == 'string' && query.length > 0) || query.queries.length > 0)}
    <h2 class="text-3xl text-center my-8">searching ...</h2>
  {/if}
</div>
