<script>

    import Adaptive from "$lib/adaptive/Adaptive.svelte";
    import { getContext } from "svelte";
    import MobileNoteContainer from "./MobileNoteContainer.svelte";

    const giState = getContext("graphInterfaceState")

</script>

{#key $giState.viewedNote?.slug}
  <Adaptive>
    <div
      class="flex-auto overflow-auto h-screen"
      style={!$giState.viewedNote || $giState.graphFullScreen ? 'flex: none; width:0px' : ''}
      slot="desktop"
    >
      <slot />
    </div>
    <MobileNoteContainer
      slot="mobile"
    >
      <slot  />
    </MobileNoteContainer>
  </Adaptive>
{/key}
