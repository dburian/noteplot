<script>
  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames;
  export { classNames as class};
</script>

<button
  on:click
  on:mousedown
  bind:this={button}
  class={`${classNames} border-2 p-2 select-none ` +
  // Normal
  `bg-back-light text-front-light border-front-light ` +
  // Dark normal
  `dark:bg-back-dark dark:text-front-dark dark:border-front-dark ` +
  // Hover
  `hover:bg-front-light hover:text-back-light ` +
  // Dark hover
  `dark:hover:bg-front-dark dark:hover:text-back-dark `}
>
  <slot />
</button>
