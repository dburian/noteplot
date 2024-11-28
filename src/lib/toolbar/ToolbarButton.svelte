<script>
  import Button from '$lib/components/Button.svelte';

  /** @type {String} */
  export let activeColor;
  /** @type {String} */
  export let defaultColor;
  /** @type {boolean} */
  export let active = false;

  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames;
  export { classNames as class };

</script>

<Button
  on:click
  on:mousedown
  on:mouseenter
  on:mouseleave
  bind:button
  class={`${classNames} ` +
    `grid content-center font-bold ` +
    `sm:text-sm ` +
    `${active ? activeColor : defaultColor} ` +
    `text-back-light stroke-back-light ` +
    `dark:text-back-dark dark:stroke-back-dark  `
  }
>
  <slot />
</Button>
