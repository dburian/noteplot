<script>
    import { getContext } from "svelte";
    import Graph from "./Graph.svelte";

  export let nodes;
  export let links;
  export let viewBox;

  const giState = getContext("graphInterfaceState")
  const adaptive = getContext("adaptive")

  // Since 100vh (which we mimic) changes as we scroll, we need to set fixed
  // height.
  let height = 1080;
  if (typeof window !== 'undefined') {
    height = window.innerHeight;
  }

  $: percentWidth = $adaptive.mobile ? 100 : 70;
  $: widthStyle = $giState.withGraph ? `width: ${percentWidth}%` : "width: 0px;flex:none";
</script>

<div
  class="flex-auto graph-container"
  style={`${widthStyle};height:${height}px`}
>
  <Graph
    {nodes}
    {links}
    {viewBox}
  />
</div>

<style>
</style>
