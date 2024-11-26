<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let debounceTime = 250;
  export let placeholder = "Search for something..."
  export let suggestions = [];
  let searchString = '';

  /** @type {HTMLInputElement} */
  let searchBarElement;

  const dispatcher = createEventDispatcher();

  /** @type {NodeJS.Timeout} */
  let debounceTimeout;

  function debounceSearch() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(search, debounceTime);
  }

  function search() {
    dispatcher('search', {
      searchString: searchString
    });
  }

  onMount(() => {
    searchBarElement.focus();
  });
</script>

<div class="border-2 w-full border-front-light dark:border-front-dark flex text-xl mb-6">
  <input
    type="text"
    class="p-1 flex-1 w-full focus-visible:outline-none dark:bg-back-dark"
    placeholder={placeholder}
    bind:value={searchString}
    on:keydown={debounceSearch}
    bind:this={searchBarElement}
  />
  <button
    class="select-none p-2 bg-back-light text-front-light dark:bg-back-dark dark:text-front-dark hover:underline"
    on:click={() => {
      searchString = '';
      search();
    }}>
    x
  </button>
</div>
<!-- <div> -->
<!--   <h6>Parsed search</h6> -->
<!--   <ul> -->
<!--   {#each fields as field} -->
<!--     <li><ul> -->
<!--       <li>search: <code>{field.search}</code></li> -->
<!--       <li>field: {field.field}</li> -->
<!--       <li>error: {field.error}</li> -->
<!--     </ul></li> -->
<!--   {/each} -->
<!--   </ul> -->
<!-- </div> -->
