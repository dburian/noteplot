<script>
  import * as d3 from "d3";
  import {onMount} from 'svelte';
  import GraphNode from "./GraphNode.svelte";


  export let nodes;
  export let links;
  export let viewBox;

  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];

  let viewportCorrectedViewBox = [...viewBox];

  let transform = { x: 0, y: 0, k: 1};
  const maxZoomCoef = 15;

  let svgTag;

  onMount(() => {
    const zoom = addZoom();

    const onResize = () => {
      const bodyWidth = document.body.clientWidth;
      const bodyHeight = document.body.clientHeight;
      const bodyAspect = bodyWidth/bodyHeight;
      const viewBoxAspect = viewBoxWidth / viewBoxHeight;
      const viewPortDiff = viewBoxAspect - bodyAspect

      //viewBox aspect is larger -> larger width or lesser height
      if (viewPortDiff > 0) {
        const newHeight = viewBoxWidth / bodyAspect;
        const heightDiff = newHeight - viewBoxHeight;

        viewportCorrectedViewBox = [
          viewBox[0],
          viewBox[1] - heightDiff/2,
          viewBox[2],
          viewBox[3] + heightDiff,
        ]
      //viewBox aspect is smaller -> smaller width or larger height
      } else if (viewPortDiff < 0) {
        const newWidth = viewBoxHeight * bodyAspect;
        const widthDiff = newWidth - viewBoxWidth;

        viewportCorrectedViewBox = [
          viewBox[0] - widthDiff/2,
          viewBox[1],
          viewBox[2] + widthDiff,
          viewBox[3],
        ]
      }
    };

    onResize()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
    }

  })

  const addZoom = () => {
    const zoomBehavior = d3.zoom()
      .scaleExtent([1, maxZoomCoef])
      .on("zoom", zoomed)
    d3.select(svgTag).call(zoomBehavior)

    function zoomed(event) {
      transform = event.transform
    }

    return zoomBehavior;
  }

  let strokeWidth = 0.05;
  $: fontSize = 0.5/transform.k**0.75;
</script>

<svg
  bind:this={svgTag}
  width="100%"
  height='100%'
  viewBox={viewportCorrectedViewBox.join(' ')}
  preserveAspectRatio="xMidYMid slice"
  class="svgGraph text-3xl sm:text-2xl md:text-xl lg:text-base"
>
  <g
    transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
    class="zoomableContainer"
    font-size={`${fontSize}em`}
  >
    {#each links as link }
      <line
        stroke-width={`${strokeWidth}em`}
        stroke='#000'
        x1={link.source.x}
        y1={link.source.y}
        x2={link.target.x}
        y2={link.target.y}
      />
    {/each}
    {#each nodes as node (node.slug)}
      <GraphNode
        transform={transform}
        {node}
        strokeWidth={strokeWidth}
        {fontSize}
      />
    {/each}
  </g>
</svg>

<style>
.svgGraph {
  background: white;
  cursor: crosshair;
  touch-action: none;
}

.zoomableContainer {
  overflow: visible;
  backface-visibility: hidden;
}
</style>
