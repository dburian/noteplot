<script>
  import { getContext } from "svelte";

  export let transform;
  export let node;
  export let strokeWidth;
  export let fontSize;

  let side = 0.6;
  let hover = false;

  const giState = getContext("graphInterfaceState")
  $: highlighted = hover || ($giState.viewedNote?.slug === node.slug)

</script>

<g
  transform={`translate(${node.x}, ${node.y})`}
  class="cursor-pointer"
  on:mouseenter={() => {hover = true}}
  on:mouseenter={() => {hover = false}}
  on:click={() => giState.update({viewedNote: node})}
  role="link"
>
  <rect
    width={`${side}em`}
    height={`${side}em`}
    x={`${-side/2}em`}
    y={`${-side/2}em`}
    stroke='black'
    stroke-width={`${strokeWidth}em`}
    fill="white"
  />
  {#if highlighted }
    <rect
      width={`${side}em`}
      height={`${side}em`}
      x={`${-side/2}em`}
      y={`${-side/2}em`}
      stroke='black'
      stroke-width={`${strokeWidth}em`}
      fill={"black"}
    />
  {/if}
  <text
    class='node-text'
    x={`${side}em`}
    dominant-baseline="middle"
    fill='black'
    stroke-width={`${strokeWidth*5}em`}
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
