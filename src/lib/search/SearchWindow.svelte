<script>
    import { getContext, tick } from "svelte";
    import SearchMatchSpans from "./SearchMatch.svelte";
    import SearchMatch from "./SearchMatch.svelte";

  export let notes;

  let searchString = "";

  let debounceTimeout;
  function debounceSearch() {
    if (searchString.length < 2) return

    searching = true;
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(search, 250)
  }

  for (const note of notes) {
    note.titleLower = note.title.toLowerCase()
    note.contentLower = note.content.toLowerCase()
  }

  let matchedNotes = [];

  function extractMatch(haystack, beginIdx, charsAround) {
    const endIdx = beginIdx + searchString.length
    const contextBeginIdx = Math.max(0, beginIdx - charsAround)
    const contextEndIdx = Math.min(haystack.length, endIdx + charsAround)

    return {
      'before': haystack.slice(contextBeginIdx, beginIdx),
      'match': haystack.slice(beginIdx, endIdx),
      'after': haystack.slice(endIdx, contextEndIdx),
    }
  }

  const MAX_MATCHES_PER_NOTE = 100
  function extractAllMatches(haystack, charsAround) {
    let beginIdx = haystack.indexOf(searchString)
    const allMatches = []
    while (beginIdx >= 0 && allMatches.length < MAX_MATCHES_PER_NOTE) {
      allMatches.push(extractMatch(haystack, beginIdx, charsAround))
      beginIdx = haystack.indexOf(searchString, beginIdx + 1)
    }

    return allMatches
  }

  let notesSearched = 0
  let searching = false;
  async function search() {
    const newMatches = []
    notesSearched = 0
    const searchTerm = searchString.toLowerCase()
    for (const note of notes) {
      const noteMatches = {
        title: [],
        content: [],
        note: {...note},
        score: 0,
      }

      if (note.titleLower.includes(searchTerm)) {
        noteMatches.title = extractAllMatches(note.titleLower, note.title.length)
        noteMatches.score += noteMatches.title.length
      }

      if (note.contentLower.includes(searchTerm)) {
        noteMatches.content = extractAllMatches(note.contentLower, 20)
        noteMatches.score += noteMatches.content.length
      }


      if (noteMatches.score > 0) {
        newMatches.push(noteMatches)
      }

      notesSearched = notesSearched + 1
    }

    matchedNotes = newMatches.sort((a, b) => b.score - a.score);
    searching = false;
  }

  const adaptive = getContext('adaptive')
  const giState = getContext('graphInterfaceContext')
  function onFocus() {
    if ($adaptive.mobile) {
      //TODO: make search working even for mobile
      //giState.large
    }
  }

</script>

<div class='w-full sm:min-w-[70ch] p-4' >
  <div class="border-2 w-full border-black flex text-xl mb-6">
    <input
      type="text"
      class="p-1 flex-1 focus-visible:outline-none"
      placeholder="Search for something..."
      bind:value={searchString}
      on:keydown={debounceSearch}
      on:focus={onFocus}
    />
  </div>
  {#if searching}
    <h2 class="text-3xl text-center my-8">Searched {notesSearched}/{notes.length} notes</h2>
  {:else if matchedNotes.length === 0 && searchString.length > 2}
    <h2 class="text-3xl text-center my-8">No notes found :(</h2>
  {:else}
    <section class="grid">
      {#each matchedNotes as match (match.note.slug)}
        <SearchMatch {match} />
      {/each}
    </section>
  {/if}
</div>
