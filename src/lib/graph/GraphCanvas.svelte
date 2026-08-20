<script>
  import { getContext, onMount } from 'svelte';
  import { CanvasGraph } from './canvas_graph';

  export let nodes;
  export let links;
  export let viewBox;

  /** @type {HTMLCanvasElement} */
  let canvas;

  const graphState = getContext('graphState');
  const filterState = getContext('filterState');
  // Desktop only — `MobileGraphInterface` has no content pane and so no
  // provider for this key.
  const sliderState = getContext('contentSliderState');

  /** @type {CanvasGraph} */
  let graph;
  onMount(() => {
    graph = new CanvasGraph(nodes, links, viewBox, canvas, graphState, filterState);
    graph.draw();

    // Keep the graph out from behind the content pane (ISSUES.md C13). The
    // pane reports its measured width, so this follows the open/close tween as
    // well as the window resizing; `setInsetRight` schedules a redraw through
    // the same rAF batching as everything else.
    const unsubscribeSlider = sliderState?.pixelWidth.subscribe(
      /** @param {number} px */ (px) => {
        graph.screen.setInsetRight(px);
      }
    );

    return () => {
      unsubscribeSlider?.();
      graph.destruct();
    };
  });
</script>

<canvas bind:this={canvas} class="touch-none bg-back-ligth dark:bg-back-dark" />
