<script>
  import GraphInterface from "$lib/graph/GraphInterface.svelte";
  import { page } from "$app/stores";

  export let data;

</script>

<GraphInterface
  graphProps={{
    nodes: data.nodes,
    links: data.links,
    viewBox: data.viewBox,
  }}
  withGraph={$page.data.withGraph}
  viewedNote={$page.data.note || null}
  graphFullScreen={data.graphFullScreen}
>
  <slot />
</GraphInterface>

