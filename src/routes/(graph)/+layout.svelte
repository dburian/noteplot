<script>
  import { page } from "$app/stores";
  import Adaptive from "$lib/adaptive/Adaptive.svelte";
  import MediaQuery from "$lib/adaptive/MediaQuery.svelte";
  import WithAdaptiveContext from "$lib/adaptive/WithAdaptiveContext.svelte";
  import Graph from "$lib/graph/Graph.svelte";
  import GraphInterface from "$lib/graph/GraphInterface.svelte";
  import WithGraphStateContext from "$lib/graph/WithGraphInterfaceState.svelte";

  export let data;

</script>

<WithAdaptiveContext>
  <WithGraphStateContext
    withGraph={$page.data.withGraph}
    viewedNote={$page.data.note || null}
    search={typeof $page.data.search === "undefined" ? null : $page.data.search}
  >
    <GraphInterface
      graphProps={{
        nodes: data.nodes,
        links: data.links,
        viewBox: data.viewBox,
      }}
    >
      <slot />
    </GraphInterface>
  </WithGraphStateContext>
</WithAdaptiveContext>

