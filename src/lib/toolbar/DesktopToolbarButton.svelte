<script>
  import ToolbarButton from './ToolbarButton.svelte';
  /** @type {String} */
  export let activeColor;
  /** @type {String} */
  export let defaultColor;
  /** @type {boolean} */
  export let on = false;
  /** @type {String} */
  export let label;


</script>

<ToolbarButton
  class={'w-8 h-8 '}
  on:click
  on:mousedown
  {defaultColor}
  {activeColor}
  {on}
  {label}
>
  <slot />
</ToolbarButton>
