<script>

    import Adaptive from "$lib/adaptive/Adaptive.svelte";
    import MobileNoteContainer from "./MobileNoteContainer.svelte";
    import { page } from "$app/stores";
</script>

{#key $page.data?.note?.slug}
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
