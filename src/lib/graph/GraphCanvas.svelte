<script>
    import { getContext, onMount } from "svelte";
    import { CanvasGraph } from "./canvas_graph";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";

  export let nodes;
  export let links;
  export let viewBox;

  /** @type {HTMLCanvasElement} */
  let canvas;

  const graphState = getContext('graphState')
  /** @type {CanvasGraph} */
  let graph
  onMount(() => {
    graph = new CanvasGraph(
      nodes,
      links,
      viewBox,
      canvas,
      (node) => goto(`/${node.slug}`),
      (node) => graphState.hover(node),
    )
    graph.draw()

    return () => {
      graph.destruct()
    }
  })

  $: {
    if (graph && $graphState.activeNote?.slug !== graph.selectedNode?.slug) {
      graph.selectNode($graphState.activeNote?.slug)
    }

    if (graph && $graphState.hoveredNote?.slug !== graph.hoveredNode?.slug) {
      graph.hoverNode($graphState.hoveredNote?.slug)
    }

  }
</script>

<canvas bind:this={canvas} class="touch-none bg-back-ligth dark:bg-back-dark" />
