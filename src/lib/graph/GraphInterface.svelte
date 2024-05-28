<script>
  import { goto } from '$app/navigation';
  import ToolbarButton from '$lib/toolbar/ToolbarButton.svelte';
  import Toolbar from '../toolbar/Toolbar.svelte';
  import Graph from './Graph.svelte';

  export let graphProps;
  export let withGraph = true;
  export let viewedNote = null;
  export let graphFullScreen = false;


  let container = null;
</script>

<div class="flex h-screen graph-note-container overflow-hidden relative" bind:this={container}>
  <div
    class="h-screen"
    style={withGraph ? "" : "width: 0px;flex:none"}
  >
    <Graph {...graphProps} {viewedNote} />
  </div>
  <Toolbar>
    {#if viewedNote}
      <ToolbarButton on:click={() => goto('/')}>x</ToolbarButton>
    {/if}
    {#if viewedNote && withGraph}
      <ToolbarButton
        on:click={() =>
          graphFullScreen ? goto(viewedNote.slug) : goto(`/notes/${viewedNote.slug}`)}
      >
        {'<'}
      </ToolbarButton>
    {/if}
    {#if viewedNote && !graphFullScreen}
      <ToolbarButton
        on:click={() => goto(`/${viewedNote.slug}${withGraph ? '?graphFullScreen' : ''}`)}
      >
        {'>'}
      </ToolbarButton>
    {/if}
  </Toolbar>
  <div
    class="w-[45%] min-w-[40ch] overflow-auto"
    style={!viewedNote || graphFullScreen ? 'flex: none; width:0px' : ''}
  >
    <slot />
  </div>
</div>
