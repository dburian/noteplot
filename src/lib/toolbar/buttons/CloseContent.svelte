<script>
    import { createEventDispatcher, getContext } from "svelte";
    import ToolbarButton from "../ToolbarButton.svelte";

  const giState = getContext("graphInterfaceState")
  const dispatcher = createEventDispatcher()
</script>

{#if $giState.withContent}
  <ToolbarButton on:click={() => {
    giState.close()
    dispatcher('click')
  }}>
    x
  </ToolbarButton>
{/if}
