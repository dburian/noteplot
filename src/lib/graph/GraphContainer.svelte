<script>
    import { getContext } from "svelte";
    import Graph from "./Graph.svelte";

  export let nodes;
  export let links;
  export let viewBox;

  const giState = getContext("graphInterfaceState")

  $: width = $giState.mobile ? 100 : 70;
  $: widthStyle = $giState.withGraph ? `width: ${width}%` : "width: 0px;flex:none";
  $: heightStyle = $giState.withGraph ? "height: 100%" : "height: 0px";
</script>

<div
  class="flex-auto graph-container"
  style={`${widthStyle};${heightStyle}`}
>
  <Graph
    {nodes}
    {links}
    {viewBox}
  />
</div>

<style>
</style>
