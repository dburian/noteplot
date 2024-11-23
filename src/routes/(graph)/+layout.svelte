<script>
  import WithAdaptiveContext from "$lib/adaptive/WithAdaptiveContext.svelte";
  import GraphInterface from "$lib/graph/GraphInterface.svelte";

  export let data;

</script>

<WithAdaptiveContext>
  <GraphInterface
    graphProps={{
      nodes: data.nodes,
      links: data.links,
      viewBox: data.viewBox,
    }}
  >
    <slot />
  </GraphInterface>
</WithAdaptiveContext>

