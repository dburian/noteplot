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

  const giState = getContext("graphInterfaceState")
  /** @type {CanvasGraph} */
  let graph
  onMount(() => {
    graph = new CanvasGraph(
      nodes,
      links,
      viewBox,
      canvas,
      (node) => goto(`/${node.slug}`),
    )
    graph.draw()

    return () => {
      graph.destruct()
    }
  })

  $: {
    // TODO: set 'activeNote' on a graph interface state, need to handle search window, ...
    if (graph && $page.data.note && $page.data.note.slug !== graph.selectedNode?.slug) {
      graph.selectNode($page.data.note.slug)
    }
  }
</script>

<canvas bind:this={canvas} class="touch-none bg-white dark:bg-neutral-800" />
