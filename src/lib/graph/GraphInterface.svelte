<script>
  import { goto } from '$app/navigation';
  import ToolbarButton from '$lib/toolbar/ToolbarButton.svelte';
  import { onMount } from 'svelte';
  import Toolbar from '../toolbar/Toolbar.svelte';
  import Graph from './Graph.svelte';
  import { createGraphState } from './graphInterfaceState';

  export let graphProps;
  export let withGraph = true;
  export let viewedNote = null;
  export let graphFullScreen = false;

  const dynamicState = createGraphState({ withGraph, viewedNote, graphFullScreen });
  $: dynamicState.update({withGraph, viewedNote, graphFullScreen})


  let container = null;
  let slider = null;
  let toolbar;

  const mouseMove = (event) => {
    slider.style.cssText = `position: absolute;top: ${event.clientY - slider.clientHeight / 2}px; left: ${event.clientX - slider.clientWidth / 2}px;`;
    const maxCursorWidth = container.clientWidth - toolbar.clientWidth;
    const snapMargin = 50;
    let cursorWidth = Math.max(
      0,
      Math.min(maxCursorWidth, event.clientX - toolbar.clientWidth / 2)
    );

    if (cursorWidth < snapMargin) {
      cursorWidth = 0;
    }

    if (maxCursorWidth - cursorWidth < snapMargin) {
      cursorWidth = maxCursorWidth;
    }

    dynamicState.update({ setWidth: cursorWidth });
  };

  const cancelMove = () => {
    dynamicState.update((state) => ({
      sliding: false,
      withGraph: state.setWidth > 0,
      graphFullScreen: state.setWidth == container.clientWidth - toolbar.clientWidth
    }));
    container.removeEventListener('mousemove', mouseMove);
    container.removeEventListener('mouseup', cancelMove);
    container.removeEventListener('mouseleave', cancelMove);
    if (slider !== null) {
      slider.style = '';
    }
  };

  const onSliderMousedown = (event) => {
    dynamicState.update({ sliding: true });
    mouseMove(event);
    container.addEventListener('mousemove', mouseMove);
    container.addEventListener('mouseup', cancelMove);
    container.addEventListener('mouseleave', cancelMove);
  };
</script>

<div class="flex h-screen graph-note-container overflow-hidden relative" bind:this={container}>
  <div
    class="graph-container h-screen"
    style={$dynamicState.width !== null ? `width: ${$dynamicState.width}px;flex: none;` : ''}
  >
    <Graph {...graphProps} {viewedNote} />
  </div>
  <Toolbar bind:toolbar>
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
    {#if viewedNote }
      <ToolbarButton bind:button={slider} on:mousedown={onSliderMousedown}>
        {'<->'}
      </ToolbarButton>
    {/if}
  </Toolbar>
  <div
    class="flex-1 overflow-auto"
    style={!viewedNote || graphFullScreen ? 'flex: none; width:0px' : ''}
  >
    <slot />
  </div>
</div>

<style>
  .graph-container {
    flex: 2 1 0%;
  }
</style>
