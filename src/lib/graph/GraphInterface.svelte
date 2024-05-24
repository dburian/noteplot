<script>
  import Toolbar from './Toolbar.svelte';
  import Graph from './Graph.svelte';

  export let graphProps;
  export let withGraph = true;
  export let viewedNote = null;
  export let graphFullScreen = false;

  let container;


  let setWidth = null;
  $: defaultWidth = graphFullScreen ? null : setWidth;
</script>

<div class="flex h-screen graph-note-container overflow-hidden" bind:this={container}>
  <div
    class="graph-container h-screen"
    style={withGraph ? (defaultWidth !== null ? `width: ${defaultWidth}px;flex: none`: "") : 'width: 0px;flex: none'}
  >
    <Graph {...graphProps} {viewedNote} />
  </div>
  <Toolbar
    {viewedNote}
    {container}
    {graphFullScreen}
    graphDisplayed={withGraph}
    on:sliderMove={(event) => {setWidth = event.detail.x}}
  />
  <div class="flex-1 overflow-auto" style={!viewedNote || graphFullScreen ? 'flex: none; width:0px' : ''}>
    <slot />
  </div>
</div>

<style>
  .graph-container {
    flex: 2 1 0%;
  }
</style>
