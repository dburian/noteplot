<script>
  import WithAdaptiveContext from '$lib/adaptive/WithAdaptiveContext.svelte';
  import WithFilterContext from '$lib/search/WithFilterContext.svelte';
  import DesktopGraphInterface from '$lib/graph/DesktopGraphInterface.svelte';
  import Adaptive from '$lib/adaptive/Adaptive.svelte';
  import WithGraphState from '$lib/graph/WithGraphState.svelte';
  import MobileGraphInterface from '$lib/graph/MobileGraphInterface.svelte';

  export let data;
</script>

<WithAdaptiveContext>
  <WithFilterContext>
    <WithGraphState>
      <Adaptive>
        <DesktopGraphInterface
          graphProps={{
            nodes: data.nodes,
            links: data.links,
            viewBox: data.viewBox
          }}
          slot="desktop"
        >
          <slot />
        </DesktopGraphInterface>
        <MobileGraphInterface
          graphProps={{
            nodes: data.nodes,
            links: data.links,
            viewBox: data.viewBox
          }}
          slot="mobile"
        >
          <slot />
        </MobileGraphInterface>
      </Adaptive>
    </WithGraphState>
  </WithFilterContext>
</WithAdaptiveContext>
