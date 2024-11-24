<script>
  import SearchMatch from "./SearchMatch.svelte";
  import {MiniSearchIndex} from "./search_index.js";
  import SearchBar from "./SearchBar.svelte";
    import QueryDisplay from "./QueryDisplay.svelte";

  export let notes;

  let searchString = "";
  /** @type {import('minisearch').Query} */
  let query;
  const index = new MiniSearchIndex(notes)

  let searching = false;
  /**
  * @type {Note[]}
  */
  let matchedNotes = [];
  /**
  * @param {string} searchString
  */
  function searchIndex(searchString) {
    query = index.parseSearchString(searchString)
    searching = true;
    matchedNotes = index.search(query);
    searching = false;
  }

</script>

<div class='w-full p-4' >
  <SearchBar
    on:search={(event) => searchIndex(event.detail.searchString)}
  />
  <QueryDisplay query={query} />
  {#if searching}
    <h2 class="text-3xl text-center my-8">searching ...</h2>
  {:else if matchedNotes.length === 0 && searchString.length > 2}
    <h2 class="text-3xl text-center my-8">no match</h2>
  {:else}
    <section class="grid">
      {#each matchedNotes as match, i (match.note.slug)}
        <SearchMatch {match} tabIndex={i} />
      {/each}
    </section>
  {/if}
</div>
