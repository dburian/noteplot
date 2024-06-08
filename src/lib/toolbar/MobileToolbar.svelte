<script>
  import { getContext } from "svelte";
import ToolbarButton from "./ToolbarButton.svelte";

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
    giState.update({wi})
  }

</script>

{#if opened}

<div
  class="fixed top-0 left-0 h-screen w-screen bg-white z-50"
>
  <div class="inline-grid w-full tmp p-8 justify-center gap-8 justify-items-center">
    <ToolbarButton on:click={() => opened = false}>x</ToolbarButton>
    <ToolbarButton>2</ToolbarButton>
    <ToolbarButton>3</ToolbarButton>
    <ToolbarButton>4</ToolbarButton>
    <ToolbarButton>5</ToolbarButton>
    <ToolbarButton>6</ToolbarButton>
    <ToolbarButton>7</ToolbarButton>
  </div>
</div>
{/if}

<div class="fixed bottom-4 right-2 z-40">
    <div
      class='grid gap-2'
    >
      {#if $giState.viewedNote}
        <ToolbarButton on:click={() => giState.update({viewedNote: null})}>{'x'}</ToolbarButton>
      {/if}
      <ToolbarButton on:click={() => opened = !opened}>{'+'}</ToolbarButton>
    </div>
</div>

<style>
.tmp {
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
}
</style>
