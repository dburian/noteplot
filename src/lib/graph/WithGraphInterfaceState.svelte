<script>
  import {createGraphInterfaceState} from "$lib/stores/graphInterfaceState.js"
  import { setContext } from "svelte";

  export let withGraph = true;
  export let viewedNote = null;

  let graphFullScreen = false
  if (typeof window !== "undefined" && window.location.search) {
    const searchParams = new URLSearchParams(window.location.search)
    graphFullScreen = searchParams.has("graphFullScreen")
  }

  const giState = createGraphInterfaceState({
    withGraph,
    graphFullScreen,
    viewedNote,
  })

  // For linking to different notes, we do not have the full information, so we
  // need to update it 
  $: differentNoteObj = $giState.viewedNote !== viewedNote
  $: sameSlug = $giState.viewedNote?.slug === viewedNote?.slug
  $: if ($giState.viewedNote && differentNoteObj && sameSlug) giState.update({viewedNote})

  setContext('graphInterfaceState', giState);
</script>

<slot />
