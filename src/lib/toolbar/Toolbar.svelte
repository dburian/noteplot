<script>
  import Adaptive from "$lib/adaptive/Adaptive.svelte";
import { getContext } from "svelte";
    import ToolbarButton from "./ToolbarButton.svelte";
    import MobileToolbar from "./MobileToolbar.svelte";

  const giState = getContext("graphInterfaceState")
</script>

<Adaptive>
  <div
    class="absolute"
    slot="desktop"
  >
  <div
    class="relative left-[-100%] mt-4 mx-4"
  >
    <div
      class='grid auto-rows-max gap-y-4'
    >
      {#if $giState.viewedNote}
        <ToolbarButton on:click={() => giState.update({viewedNote: null})}>x</ToolbarButton>
      {/if}
      {#if $giState.viewedNote && $giState.withGraph}
        <ToolbarButton
          on:click={() => giState.update(oldState => ({
            graphFullScreen: false,
            withGraph: oldState.graphFullScreen
          }))}
        >
          {'<'}
        </ToolbarButton>
      {/if}
      {#if $giState.viewedNote && !$giState.graphFullScreen}
        <ToolbarButton
          on:click={() => giState.update(oldState => ({
            withGraph: true,
            graphFullScreen: oldState.withGraph,
          }))}
        >
          {'>'}
        </ToolbarButton>
      {/if}
      <ToolbarButton>?</ToolbarButton>
    </div>
  </div>
  </div>
  <svelte:fragment
    slot="mobile"
  >
    {#if $giState.withGraph}
      <MobileToolbar />
    {/if}
  </svelte:fragment>
</Adaptive>
