<script>
  import Toolbar from '../toolbar/Toolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Note from '$lib/note/Note.svelte';
  import { getContext } from 'svelte';

  export let graphProps;

  const giState = getContext("graphInterfaceState")
  $: width = ""
  $: {
    if (!$giState.mobile) {
      if (!$giState.withGraph) {
        width = "calc(100vw - 4.5rem)"
      } else if (!$giState.withContent || $giState.graphFullScreen) {
        width = "0px"
      } else {
        width = "unset";
      }
    }
  }
</script>

<GraphContainer
  {...graphProps}
/>
<div
  class={`sm:fixed sm:top-0 sm:right-0 sm:border-l-black dark:sm:border-l-invert-white ${$giState.graphFullScreen || !$giState.withContent ? "" : "sm:border-l-2"}`}
  style={`width: ${width}`}
>
  <Toolbar />
  <Note>
    <slot />
  </Note>
</div>

