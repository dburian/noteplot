<script>

    import Adaptive from "$lib/adaptive/Adaptive.svelte";
    import { getContext } from "svelte";
    import MobileNoteContainer from "./MobileNoteContainer.svelte";

    const giState = getContext("graphInterfaceState")

</script>

{#key $giState.viewedNote?.slug}
  <Adaptive>
    <div
      class="overflow-auto h-screen w-full bg-white dark:bg-neutral-800 dark:text-white"
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

<style>
</style>
