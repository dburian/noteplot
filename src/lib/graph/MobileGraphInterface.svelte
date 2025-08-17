
<script>
  import MobileToolbar from "$lib/toolbar/MobileToolbar.svelte";
  import { getContext } from "svelte";
  import GraphContainer from "./GraphContainer.svelte";


  export let graphProps;
  const pageState = getContext('graphState')
  const contentState= getContext('contentState')
</script>

<GraphContainer {...graphProps} />
<MobileToolbar />

{#if $pageState.activeNote !== null && !$contentState.noContent}
  <div class='top-0 left-0 absolute bg-white w-screen min-h-screen'>
    <slot />
  </div>
{/if}
