<script>
  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames = "";
  export { classNames as class};
</script>

<button
  on:click
  on:mousedown
  on:mouseenter
  on:mouseleave
  bind:this={button}
  class={`${classNames} select-none p-2 outline-none` +
  // Normal
  //`bg-front-light text-back-light ` +
  // Dark normal
  //`dark:bg-front-dark dark:text-back-dark ` +
  // Hover
  //`hover:bg-front-light hover:text-back-light ` +
  // Dark hover
  //`dark:hover:bg-front-dark dark:hover:text-back-dark `
  ''}
>
  <slot />
</button>
