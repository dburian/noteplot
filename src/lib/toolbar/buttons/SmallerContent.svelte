<script>
    import { getContext } from "svelte";
    import ToolbarButton from "../ToolbarButton.svelte";

  const giState = getContext("graphInterfaceState")
</script>

{#if $giState.withContent && !$giState.graphFullScreen}
  <ToolbarButton on:click={() => giState.smallerContent()}>
    {'>'}
  </ToolbarButton>
{/if}
