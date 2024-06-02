<script>
  import ToolbarButton from '$lib/toolbar/ToolbarButton.svelte';
  import { getContext, onMount } from 'svelte';
  import Toolbar from '../toolbar/Toolbar.svelte';
  import Graph from './Graph.svelte';
    import Adaptive from '$lib/adaptive/Adaptive.svelte';
    import GraphContainer from './GraphContainer.svelte';
    import MobileNoteContainer from './MobileNoteContainer.svelte';

  export let graphProps;

  const giState = getContext("graphInterfaceState");

  let container = null;
</script>

<div class="sm:flex h-full relative" bind:this={container}>
  <GraphContainer
    {...graphProps}
  />
  <Adaptive>
    <Toolbar
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
    </Toolbar>
  </Adaptive>
  <Adaptive>
    <div
      class="flex-auto overflow-auto h-screen"
      style={!$giState.viewedNote || $giState.graphFullScreen ? 'flex: none; width:0px' : ''}
      slot="desktop"
    >
      <slot />
    </div>
    <MobileNoteContainer slot="mobile">
      <slot />
    </MobileNoteContainer>
  </Adaptive>
</div>

