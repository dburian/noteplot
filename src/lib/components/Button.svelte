<script>
  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** Native tooltip. The toolbar's items are text-only, so this is where the longer explanation goes. @type {string} */
  export let title = '';
  /** @type {string} */
  let classNames = '';
  export { classNames as class };
</script>

<button
  type="button"
  on:click
  on:auxclick
  on:mousedown
  on:mouseenter
  on:mouseleave
  bind:this={button}
  title={title || undefined}
  class={`${classNames} select-none outline-none`}
>
  <slot />
</button>
