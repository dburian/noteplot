<script>
  import SearchMatch from "./SearchMatch.svelte";
  import {MiniSearchIndex} from "./search_index.js";
  import SearchBar from "./SearchBar.svelte";
    import QueryDisplay from "./QueryDisplay.svelte";
    import { getContext } from "svelte";

  export let notes;

  /** @type {import('minisearch').Query} */
  let query;

  const index = new MiniSearchIndex(notes)
  let searching = false;

  const filterContext = getContext('filterState')

  /**
  * @param {string} searchString
  */
  function searchIndex(searchString) {
    if (searchString === '') {
      filterContext.clear()
      query = null
      return
    }

    query = index.parseSearchString(searchString)
    filterContext.setQuery(query)
    searching = true;
    filterContext.setResults(index.search(query));
    searching = false;
  }

</script>

<div class='w-full p-4' >
  <h5 class="text-4xl my-8 text-center">Filter</h5>
  <SearchBar
    placeholder="Filter notes"
    on:search={(event) => searchIndex(event.detail.searchString)}
  />
  <QueryDisplay query={query} />
  {#if $filterContext.results !== null && $filterContext.results.length === 0}
    <h2 class="text-3xl text-center my-8">no match</h2>
  {:else if $filterContext.results !== null}
    <section class="grid">
      {#each $filterContext.results as match, i (match.note.slug)}
        <SearchMatch {match} tabIndex={i} />
      {/each}
    </section>
  {/if}
</div>
