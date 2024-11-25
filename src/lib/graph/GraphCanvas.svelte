<script>
    import { getContext, onMount } from "svelte";
    import { CanvasGraph } from "./canvas_graph";

  export let nodes;
  export let links;
  export let viewBox;

  /** @type {HTMLCanvasElement} */
  let canvas;

  const graphState = getContext('graphState')
  const filterState = getContext('filterState')

  /** @type {CanvasGraph} */
  let graph
  onMount(() => {
    graph = new CanvasGraph(
      nodes,
      links,
      viewBox,
      canvas,
      graphState,
      filterState,
    )
    graph.draw()

    return () => {
      graph.destruct()
    }
  })

</script>

<canvas bind:this={canvas} class="touch-none bg-back-ligth dark:bg-back-dark" />
