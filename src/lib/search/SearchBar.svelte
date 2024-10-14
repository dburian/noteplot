<script>
    import { createEventDispatcher } from "svelte";

  export let debounceTime = 250;
  let searchString = "";

  const dispatcher = createEventDispatcher()

  function debounceSearch() {
    if (searchString.length < 2) return

    clearTimeout(this.debounceTimeout)
    this.debounceTimeout = setTimeout(search, debounceTime)
  }

  function search() {
    dispatcher('search', {
      'searchString': searchString,
    })
  }
</script>

  <div class="border-2 w-full border-black dark:border-invert-white flex text-xl mb-6">
    <input
      type="text"
      class="p-1 flex-1 focus-visible:outline-none dark:bg-neutral-800"
      placeholder="Search for something..."
      bind:value={searchString}
      on:keydown={debounceSearch}
    />
  </div>
