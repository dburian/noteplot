<script>
  import WithAdaptiveContext from "$lib/adaptive/WithAdaptiveContext.svelte";
  import GraphInterface from "$lib/graph/GraphInterface.svelte";
    import WithUrlStateContext from "$lib/WithUrlStateContext.svelte";

  export let data;

</script>

<WithAdaptiveContext>
  <WithUrlStateContext>
    <GraphInterface
      graphProps={{
        nodes: data.nodes,
        links: data.links,
        viewBox: data.viewBox,
      }}
    >
      <slot />
    </GraphInterface>
  </WithUrlStateContext>
</WithAdaptiveContext>

