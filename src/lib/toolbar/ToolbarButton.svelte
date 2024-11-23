<script>
    import Button from "$lib/components/Button.svelte";

  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames;
  export { classNames as class};
</script>

<Button
  on:click
  on:mousedown
  bind:button
  class={`${classNames} ` +
  `grid content-center font-bold ` +
  `sm:text-sm ` +
  // Svg normal and hover
  `stroke-back-light `+
  // Dark svg normal and hover
  `dark:stroke-back-dark  `}
>
  <slot />
</Button>
