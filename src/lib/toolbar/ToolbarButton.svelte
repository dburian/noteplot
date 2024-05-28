<script>
  export let button = null;
</script>

<button
  on:click
  on:mousedown
  bind:this={button}
  class="w-10 h-10 grid content-center bg-white border-2 font-bold border-black select-none hover:bg-black hover:text-white"
>
<slot />
</button>
