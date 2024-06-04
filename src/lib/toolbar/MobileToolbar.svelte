<script>
    import ToolbarButton from "./ToolbarButton.svelte";


  let opened = false;

  let originalStyle = "";
  function toggle() {
    if (!opened) {
      //TODO: scroll lock
      //originalStyle = document.body.style
      //document.body.style = "
    }
  }

</script>

<div
  class="fixed top-0 right-0"
  style={opened ? "width: min(80%, calc(100% - 7rem));" : ""}
  >
  <div class="absolute">
    <div class="relative left-[-100%] top-4 mr-4">
      <ToolbarButton on:click={() => opened = !opened}>{opened ? '>' : '<'}</ToolbarButton>
    </div>
  </div>

  {#if opened}
    <div class="w-full h-screen bg-white">
      <div class="inline-grid w-full tmp p-8 justify-center gap-8 justify-items-center">
        <ToolbarButton>1</ToolbarButton>
        <ToolbarButton>2</ToolbarButton>
        <ToolbarButton>3</ToolbarButton>
        <ToolbarButton>4</ToolbarButton>
        <ToolbarButton>5</ToolbarButton>
        <ToolbarButton>6</ToolbarButton>
        <ToolbarButton>7</ToolbarButton>
      </div>
    </div>
  {/if}
</div>

<style>
.tmp {
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
}
</style>
