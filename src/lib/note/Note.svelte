<script>

    import Adaptive from "$lib/adaptive/Adaptive.svelte";
    import MobileNoteContainer from "./MobileNoteContainer.svelte";
    import { page } from "$app/stores";
</script>

{#key $page.data?.note?.slug}
  <Adaptive>
    <div
      class="overflow-auto h-screen w-full bg-back-light dark:bg-back-dark text-front-light dark:text-front-dark"
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
