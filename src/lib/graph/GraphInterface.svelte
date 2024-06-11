<script>
  import Toolbar from '../toolbar/Toolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Note from '$lib/note/Note.svelte';

  export let graphProps;

  let container = null;
</script>

<div class="sm:flex h-full" bind:this={container}>
  <GraphContainer
    {...graphProps}
  />
  <Toolbar />
  <Note>
    <slot />
  </Note>
</div>

