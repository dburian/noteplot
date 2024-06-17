<script>
    import { createEventDispatcher, getContext } from "svelte";
    import ToolbarButton from "../ToolbarButton.svelte";

  const giState = getContext("graphInterfaceState")
  const dispatcher = createEventDispatcher()
</script>


{#if $giState.search === null}
  <ToolbarButton
    on:click={() => {
      giState.update({
        search: '',
        viewedNote: null,
        graphFullScreen: false
      })
      dispatcher('click')
    }}
  >
    ?
  </ToolbarButton>
{/if}
