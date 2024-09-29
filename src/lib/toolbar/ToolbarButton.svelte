<script>
    import { getContext } from "svelte";

  export let button = null;

  const adaptive = getContext("adaptive")
</script>

<button
  on:click
  on:mousedown
  bind:this={button}
  class={`${$adaptive.mobile ? 'w-12 h-12': 'w-10 h-10'} grid content-center bg-white dark:bg-neutral-800 border-2 font-bold border-black dark:border-invert-white select-none dark:text-white hover:bg-black dark:hover:bg-invert-white hover:text-white dark:hover:text-neutral-800 text-base sm:text-base`}>
  <slot />
</button>
