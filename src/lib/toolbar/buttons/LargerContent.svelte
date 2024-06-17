<script>
    import { getContext } from "svelte";
    import ToolbarButton from "../ToolbarButton.svelte";

  const giState = getContext("graphInterfaceState")
</script>

{#if $giState.withContent && $giState.withGraph}
  <ToolbarButton on:click={() => giState.largerContent()}>
    {'<'}
  </ToolbarButton>
{/if}
