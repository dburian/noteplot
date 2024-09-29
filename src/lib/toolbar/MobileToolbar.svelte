<script>
  import { getContext } from "svelte";
import ToolbarButton from "./ToolbarButton.svelte";
    import Search from "./buttons/Search.svelte";
    import CloseContent from "./buttons/CloseContent.svelte";

  const giState = getContext("graphInterfaceState")

  let opened = false;

  let originalStyle = "";
  function toggle() {
    if (!opened) {
      //TODO: scroll lock
      //originalStyle = document.body.style
      //document.body.style = "
    }
  }

  function gotoGraph() {
  }

  function close() {
    opened = false
  }

</script>

{#if opened}

<div
  class="fixed top-0 left-0 h-screen w-screen bg-white dark:bg-neutral-800 z-50"
>
  <div class="inline-grid w-full tmp p-8 justify-center gap-8 justify-items-center">
    <ToolbarButton on:click={close}>-</ToolbarButton>
    <Search on:click={close} />
    <CloseContent on:click={close} />
  </div>
</div>
{/if}

<div class="fixed bottom-4 right-2 z-40">
    <div
      class='grid gap-2'
    >
      <ToolbarButton on:click={() => opened = !opened}>{'+'}</ToolbarButton>
    </div>
</div>

<style>
.tmp {
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
}
</style>
