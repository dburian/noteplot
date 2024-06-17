<script>
  import {createGraphState} from "$lib/stores/graphInterfaceState.js"
  import { getContext, setContext } from "svelte";

  export let withGraph = true;
  export let viewedNote = null;
  export let search = null;

  let graphFullScreen = false
  if (typeof window !== "undefined" && window.location.search) {
    const searchParams = new URLSearchParams(window.location.search)
    graphFullScreen = searchParams.has("graphFullScreen")
  }

  const adaptive = getContext("adaptive")
  const giState = createGraphState(
    {
      withGraph,
      graphFullScreen,
      viewedNote,
      search,
      ...$adaptive,
    }
  )

  // For linking to different notes, we do not have the full information, so we
  // need to update it.
  $: differentNoteObj = $giState.viewedNote !== viewedNote
  $: sameSlug = $giState.viewedNote?.slug === viewedNote?.slug
  $: if ($giState.viewedNote && differentNoteObj && sameSlug) giState.update({viewedNote})

  $: if ($giState.mobile !== $adaptive.mobile) giState.update({...$adaptive})

  setContext('graphInterfaceState', giState);
</script>

<slot />
