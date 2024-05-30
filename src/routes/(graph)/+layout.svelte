<script>
  import { page } from "$app/stores";
    import GraphInterface from "$lib/graph/GraphInterface.svelte";
  import WithGraphInterfaceState from "$lib/graph/WithGraphInterfaceState.svelte";

  export let data;

</script>

<WithGraphInterfaceState
  withGraph={$page.data.withGraph}
  viewedNote={$page.data.note || null}
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
</WithGraphInterfaceState>

