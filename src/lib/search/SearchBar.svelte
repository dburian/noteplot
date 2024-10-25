<script>
    import { createEventDispatcher, onMount } from "svelte";
    import SearchMatchSpans from "./SearchMatchSpans.svelte";

  export let debounceTime = 250;
  export let suggestions = []
  let searchString = "";
  /** @type {HTMLInputElement} */
  let searchBarElement;

  const dispatcher = createEventDispatcher()

  function debounceSearch() {
    clearTimeout(this.debounceTimeout)
    this.debounceTimeout = setTimeout(search, debounceTime)
  }

  function search() {
    dispatcher('search', {
      'searchString': searchString,
    })
  }

  onMount(() => {
    searchBarElement.focus()
  })
</script>

  <div class="border-2 w-full border-front-light dark:border-front-dark flex text-xl mb-6">
    <input
      type="text"
      class="p-1 w-full flex-1 focus-visible:outline-none dark:bg-back-dark"
      placeholder="Search for something..."
      bind:value={searchString}
      on:keydown={debounceSearch}
      bind:this={searchBarElement}
    />
  </div>
