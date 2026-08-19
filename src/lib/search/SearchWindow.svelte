<script>
  import SearchMatch from './SearchMatch.svelte';
  import { getSearchIndex } from './search_index.js';
  import SearchBar from './SearchBar.svelte';
  import QueryDisplay from './QueryDisplay.svelte';
  import { getContext } from 'svelte';

  export let notes;

  /** @type {import('minisearch').Query} */
  let query;

  const index = getSearchIndex(notes);
  let searching = false;

  /**
   * @type import('./search_index').Match[] | null */
  let results = null;

  /**
   * @param {string} searchString
   */
  async function searchIndex(searchString) {
    query = index.parseSearchString(searchString);
    searching = true;
    // The index is built with `addAllAsync`, so a query typed right after the
    // pane opens can outrun it and match nothing (ISSUES.md B4).
    await index.ready();
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
  {#if searching}
    <h2 class="text-3xl text-center my-8">searching ...</h2>
  {:else if results !== null && results.length > 0}
    <section class="grid">
      {#each results as match, i (match.note.slug)}
        <SearchMatch {match} tabIndex={i} />
      {/each}
    </section>
  {:else if results !== null}
    <h2 class="text-3xl text-center my-8">no match</h2>
  {/if}
</div>
