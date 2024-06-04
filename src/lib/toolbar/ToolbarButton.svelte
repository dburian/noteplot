<script>
    import { getContext } from "svelte";

  export let button = null;

  const baseClasses =
    'grid content-center bg-white border-2 font-bold border-black select-none hover:bg-black hover:text-white text-base sm:text-base';

  const adaptive = getContext("adaptive")
  $: sizeClasses = $adaptive.mobile ? "w-12 h-12": "w-10 h-10";
</script>

<button on:click on:mousedown bind:this={button} class={`${sizeClasses} ${baseClasses}`}>
  <slot />
</button>
