<script>
  import ToolbarButton from '$lib/toolbar/ToolbarButton.svelte';
  import { getContext, onMount } from 'svelte';
  import Toolbar from '../toolbar/Toolbar.svelte';
  import Adaptive from '$lib/adaptive/Adaptive.svelte';
  import GraphContainer from './GraphContainer.svelte';

  export let graphProps;

  const giState = getContext("graphInterfaceState");

  let container = null;
</script>

<div class="sm:flex h-full relative" bind:this={container}>
  <GraphContainer
    {...graphProps}
  />
  <Toolbar />
  <Adaptive>
    <div
      class="flex-auto overflow-auto h-screen"
      style={!$giState.viewedNote || $giState.graphFullScreen ? 'flex: none; width:0px' : ''}
      slot="desktop"
    >
      <slot />
    </div>
    <slot slot="mobile" />
  </Adaptive>
</div>

