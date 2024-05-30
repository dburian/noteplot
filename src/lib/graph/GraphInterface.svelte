<script>
  import { goto } from '$app/navigation';
  import ToolbarButton from '$lib/toolbar/ToolbarButton.svelte';
    import { getContext, onMount } from 'svelte';
  import Toolbar from '../toolbar/Toolbar.svelte';
  import Graph from './Graph.svelte';

  export let graphProps;

  const giState = getContext("graphInterfaceState");

  let container = null;
</script>

<div class="flex h-screen graph-note-container overflow-hidden relative" bind:this={container}>
  <div
    class="h-screen flex-auto"
    style={$giState.withGraph ? "width: 70%" : "width: 0px;flex:none"}
  >
    <Graph {...graphProps} />
  </div>
  <Toolbar>
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
  </Toolbar>
  <div
    class="flex-auto overflow-auto"
    style={!$giState.viewedNote || $giState.graphFullScreen ? 'flex: none; width:0px' : ''}
  >
    <slot />
  </div>
</div>

