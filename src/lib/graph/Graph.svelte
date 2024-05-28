<script>
  import * as d3 from "d3";
  import {onMount} from 'svelte';
  import GraphNode from "./GraphNode.svelte";


  export let nodes;
  export let links;
  export let viewBox;
  export let viewedNote;

  const viewBoxWidth = viewBox[2] - viewBox[0];
  const viewBoxHeight = viewBox[3] - viewBox[1];
  const adjustedViewBox = [
    viewBox[0] - 0.1 * viewBoxWidth,
    viewBox[1] - 0.1 * viewBoxHeight,
    viewBox[2] + 0.2 * viewBoxWidth,
    viewBox[3] + 0.2 * viewBoxHeight
  ];

  let maxX = 0;
  let maxY = 0;

  for (const node of nodes) {
    maxX = Math.max(node.x, maxX);
    maxY = Math.max(node.y, maxY);
  }

  let transform = { x: 0, y: 0, k: 1};
  const maxZoomCoef = 10
  let scale = 0;

  $: lineWidth = 0.5 + 0.5*scale;

  let svgTag;

  onMount(() => {
    addZoom();
  })

  const addZoom = () => {
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, maxZoomCoef])
      .on("zoom", zoomed)
    d3.select(svgTag).call(zoomBehavior)

    function zoomed(event) {
      transform = event.transform;
      const normZoom = (event.transform.k - 1) / (maxZoomCoef - 1);

      // This is to achieve first fast but gradually slower zoom effect.
      // With larger logScale, the slower the zoom effect will be at the max
      // zoom.

      const logScale = 10
      scale = Math.log(normZoom* logScale + 1) / Math.log(logScale + 1)
    }
  }
</script>

<svg
  bind:this={svgTag}
  width="100%"
  height='100%'
  viewBox={adjustedViewBox.join(' ')}
  class="svgGraph"
>
  <g
    transform={`translate(${transform.x}, ${transform.y})`}
    class="zoomableContainer"
  >
    {#each links as link }
      <line
        stroke-width={lineWidth}
        stroke='#000'
        x1={link.source.x * transform.k}
        y1={link.source.y * transform.k}
        x2={link.target.x * transform.k}
        y2={link.target.y * transform.k}
      />
    {/each}
    {#each nodes as node (node.slug)}
      <GraphNode
        node={{x: node.x * transform.k,y: node.y * transform.k, id: node.slug, title: node.title}}
        {scale}
        {lineWidth}
        active={viewedNote && viewedNote.slug === node.slug}
      />
    {/each}
  </g>
</svg>

<style>
.svgGraph {
  background: white;
  cursor: crosshair;
}

.zoomableContainer {
  overflow: visible;
  backface-visibility: hidden;
}
</style>
