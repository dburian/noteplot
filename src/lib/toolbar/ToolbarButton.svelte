<script>
  import Button from '$lib/components/Button.svelte';

  /** @type {String} */
  export let activeColor;
  /** @type {String} */
  export let defaultColor;
  /** @type {boolean} */
  export let on = false;

  /** @type {String} */
  export let label;

  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames;
  export { classNames as class };

  let hover = false

</script>

<Button
  on:click
  on:mousedown
  on:mouseenter={() => {hover = true}}
  on:mouseleave={() => {hover = false}}
  bind:button
  class={`${classNames} ` +
    `grid content-center font-bold ` +
    `sm:text-sm ` +
    `${on != hover ? activeColor : defaultColor} ` +
    `text-back-light stroke-back-light ` +
    `dark:text-back-dark dark:stroke-back-dark  `
  }
>
  <slot />
</Button>
