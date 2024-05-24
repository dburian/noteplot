<script>
  export let node;
  export let scale;
  export let active;
  export let lineWidth;

  // Bigger stuff
  //$: side = 6 + 7 * scale
  $: side = 3 + 4 * scale
  $: innerSide = side * 1

  let hover = false;

  $: highlighted = hover || active
  //$: fontSize = 6 + 4 *  scale
  $: fontSize = 5 + 4 *  scale

</script>

<g transform={`translate(${node.x}, ${node.y})`}>
  <a
    href={`/${node.id}`}
    aria-label={node.id}
    style="cursor: pointer"
    on:pointerenter={(_) => {hover = true}}
    on:pointerleave={(_) => {hover = false}}
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
  </a>
  <text
    class='node-text'
    x={side/2 + side*0.6}
    dominant-baseline="middle"
    fill='black'
    font-size={`${fontSize}px`}
    stroke-width={`${fontSize*0.5}px`}
  >
    {#if scale > 0.2 || highlighted}
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
