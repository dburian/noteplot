<script>
  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** Native tooltip. The toolbar's items are text-only, so this is where the longer explanation goes. @type {string} */
  export let title = '';
  /**
   * Greys the control out and takes it out of the tab order. The command
   * palette needs it: a command that is not currently available stays listed
   * rather than disappearing, and `:not([disabled])` is what keeps it out of
   * the overlay's focus trap.
   *
   * @type {boolean}
   */
  export let disabled = false;
  /** @type {string} */
  let classNames = '';
  export { classNames as class };
</script>

<button
  type="button"
  {disabled}
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
