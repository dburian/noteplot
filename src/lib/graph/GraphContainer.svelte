<script>
  import GraphCanvas from "./GraphCanvas.svelte";

  export let nodes;
  export let links;
  export let viewBox;
</script>

<div
  class="w-screen h-screen fixed top-0 left-0"
>
  <GraphCanvas
    {nodes}
    {links}
    {viewBox}
  />
</div>
