<script>
    import { getContext } from "svelte";

  export let transform;
  export let node;
  export let lineWidth;

  // Bigger stuff
  //$: side = 6 + 7 * scale
  $: side = 3
  $: innerSide = side * 1

  let hover = false;

  const giState = getContext("graphInterfaceState")
  $: highlighted = hover || ($giState.viewedNote?.slug === node.slug)
  //$: fontSize = 6 + 4 *  scale
  $: fontSize = 5

</script>

<g
  transform={`translate(${node.x}, ${node.y})`}
  class="cursor-pointer"
  on:pointerenter={(_) => {hover = true}}
  on:pointerleave={(_) => {hover = false}}
  on:click={() => giState.update({viewedNote: node})}
>
  <rect
    width={side}
    height={side}
    x={-side/2}
    y={-side/2}
    stroke='black'
    stroke-width={lineWidth}
    fill="white"
  />
  {#if highlighted }
    <rect
      width={innerSide}
      height={innerSide}
      x={-innerSide/2}
      y={-innerSide/2}
      fill={"black"}
    />
  {/if}
  <text
    class='node-text'
    x={side/2 + side*0.6}
    dominant-baseline="middle"
    fill='black'
    font-size={`${fontSize}px`}
    stroke-width={`${fontSize*0.5}px`}
  >
    {#if transform.k > 2.2 || highlighted}
      {node.title}
    {/if}
  </text>
</g>

<style>
.node-text {
  paint-order: stroke;
  stroke: #fff;
  z-index: 100;
}
</style>
