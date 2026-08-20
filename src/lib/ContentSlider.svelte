<script>
  import { getContext } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  /**
   * The content pane itself. Everything about *how wide it should be* lives in
   * `content/WithContentSliderState.svelte`, one level up, because the graph
   * canvas is a sibling of this component and needs the same number.
   */
  const sliderState = getContext('contentSliderState');

  const sliderWidth = tweened($sliderState.width, {
    duration: 400,
    easing: cubicOut
  });

  $: if ($sliderState.width !== $sliderWidth) sliderWidth.set($sliderState.width);

  // The pane's rendered width, published so `CanvasScreen` can inset the graph
  // by it (ISSUES.md C13). Measured rather than recomputed from `$sliderWidth`:
  // the `max-width` below clamps it, and measuring tracks the tween for free.
  /** @type {number} */
  let paneWidth = 0;
  $: sliderState.pixelWidth.set(paneWidth);
</script>

<div
  bind:clientWidth={paneWidth}
  class={`sm:fixed sm:top-0 sm:right-0 sm:border-l-front-light dark:sm:border-l-front-dark ${$sliderState.width > 0 && 'sm:border-l-2'}`}
  style={`width: ${$sliderWidth * 100}vw; max-width: calc(100vw - 4.5rem)`}
>
  <slot />
</div>
