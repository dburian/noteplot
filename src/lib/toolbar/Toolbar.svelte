<script>
  import Adaptive from "$lib/adaptive/Adaptive.svelte";
import { getContext } from "svelte";
    import ToolbarButton from "./ToolbarButton.svelte";
    import MobileToolbar from "./MobileToolbar.svelte";

  const giState = getContext("graphInterfaceState")
</script>

<Adaptive>
  <div
    class='h-screen grid auto-rows-max gap-y-4 p-4'
    slot="desktop"
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
  </div>
  <svelte:fragment
    slot="mobile"
  >
    {#if $giState.withGraph}
      <MobileToolbar />
    {/if}
  </svelte:fragment>
</Adaptive>
