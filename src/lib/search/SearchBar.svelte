<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let debounceTime = 250;
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
  <div class="p-1 w-full flex-1 relative">
    <!-- <div class="bg-front-light absolute flex-1"> -->
    <!--   {searchString} -->
    <!-- </div> -->
    <input
      type="text"
      class="w-full focus-visible:outline-none dark:bg-back-dark"
      placeholder="Search for something..."
      bind:value={searchString}
      on:keydown={debounceSearch}
      bind:this={searchBarElement}
    />
  </div>
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
