<script>
  import SearchMatch from "./SearchMatch.svelte";
  import {NoLibSearchIndex} from "./search_index.js";
  import SearchBar from "./SearchBar.svelte";

  export let notes;

  let searchString = "";
  let index = new NoLibSearchIndex(notes)

  let searching = false;
  let matchedNotes = [];
  /**
  * @param {string} searchString
  */
  async function searchIndex(searchString) {
    searching = true;
    matchedNotes = await index.search(searchString);
    searching = false;
  }

</script>

<div class='w-full sm:min-w-[70ch] p-4' >
  <SearchBar
    on:search={(event) => searchIndex(event.detail.searchString)}
  />
  {#if searching}
    <h2 class="text-3xl text-center my-8">searching ...</h2>
  {:else if matchedNotes.length === 0 && searchString.length > 2}
    <h2 class="text-3xl text-center my-8">no match</h2>
  {:else}
    <section class="grid">
      {#each matchedNotes as match (match.note.slug)}
        <SearchMatch {match} />
      {/each}
    </section>
  {/if}
</div>
