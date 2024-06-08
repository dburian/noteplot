<script>
    import { getContext} from "svelte";

  const giState = getContext("graphInterfaceState")

</script>

{#if $giState.viewedNote}
  <div
    class="grid"
    style="margin-top:-100px"
  >
    <div class="shadow-hover bg-white z-10 w-full">
      <slot />
    </div>
  </div>
{/if}
