<script>
    import { getContext, onMount } from "svelte";
    import { CanvasGraph } from "./canvas_graph";

  export let nodes;
  export let links;
  export let viewBox;

  let canvas;

  const giState = getContext("graphInterfaceState")
  let graph = null
  onMount(() => {
    graph = new CanvasGraph(
      nodes,
      links,
      viewBox,
      canvas,
      (node) => giState.viewNote(node),
    )
    graph.draw()

    return () => {
      graph.destruct()
    }
  })

  $: {
    if (graph && graph.selectedNode?.slug !== $giState.viewedNote?.slug) {
      graph.selectNode($giState.viewedNote?.slug)
    }
  }
</script>

<canvas bind:this={canvas} class="touch-none bg-white dark:bg-neutral-800" />
