<script>
  import WithAdaptiveContext from "$lib/adaptive/WithAdaptiveContext.svelte";
  import WithFilterContext from "$lib/search/WithFilterContext.svelte";
  import GraphInterface from "$lib/graph/GraphInterface.svelte";

  export let data;
</script>

<WithAdaptiveContext>
  <WithFilterContext>
    <GraphInterface
      graphProps={{
        nodes: data.nodes,
        links: data.links,
        viewBox: data.viewBox,
      }}
    >
      <slot />
    </GraphInterface>
  </WithFilterContext>
</WithAdaptiveContext>

