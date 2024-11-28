<script>
    import { tweened } from 'svelte/motion';
  import ToolbarButton from './ToolbarButton.svelte';
    import { expoInOut } from 'svelte/easing';
  /** @type {String} */
  export let activeColor;
  /** @type {String} */
  export let defaultColor;
  /** @type {boolean} */
  export let on = false;
  /** @type {String} */
  export let label;

  let hover = false
  $: active = hover != on

  /** @type {HTMLElement} */
  let widthRef

  let width = tweened(0, {
    duration: 300,
    easing: expoInOut,
  })
</script>

<div class="relative">
  <ToolbarButton
    class={'w-8 h-8'}
    on:click
    on:mousedown
    on:mouseenter={() => {
      hover = true;
      width.set(widthRef.clientWidth)
    }}
    on:mouseleave={() => {
      hover = false;
      width.set(0)
    }}
    {defaultColor}
    {activeColor}
    {active}
  >
    <slot />
  </ToolbarButton>
  <div
    class="absolute w-0 right-[2.5rem] overflow-clip top-0"
    style={`width: ${$width}px`}
  >
    <div
      class={`${active ? activeColor : defaultColor} grid content-center text-sm h-8 w-[max-content] font-bold px-2`}
      bind:this={widthRef}
    >
      {label}
    </div>
  </div>
</div>
