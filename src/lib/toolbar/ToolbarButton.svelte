<script>
  export let button;
  export let sizeClasses;
</script>

<button
  on:click
  on:mousedown
  bind:this={button}
  class={`${sizeClasses} grid content-center bg-white dark:bg-neutral-800 border-2 font-bold border-black dark:border-invert-white select-none dark:text-white hover:bg-black dark:hover:bg-invert-white hover:text-white dark:hover:text-neutral-800 text-base sm:text-sm stroke-black dark:stroke-invert-white hover:stroke-white hover:dark:stroke-neutral-800 p-2`}
>
  <slot />
</button>
