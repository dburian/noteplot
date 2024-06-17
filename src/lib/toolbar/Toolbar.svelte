<script>
  import Adaptive from "$lib/adaptive/Adaptive.svelte";
  import { getContext } from "svelte";
  import MobileToolbar from "./MobileToolbar.svelte";
  import CloseContent from "./buttons/CloseContent.svelte";
  import LargerContent from "./buttons/LargerContent.svelte";
  import SmallerContent from "./buttons/SmallerContent.svelte";
  import Search from "./buttons/Search.svelte";

  const giState = getContext("graphInterfaceState")
</script>

<Adaptive>
  <div
    class="absolute"
    slot="desktop"
  >
  <div
    class="relative left-[-100%] mt-4 mx-4"
  >
    <div
      class='grid auto-rows-max gap-y-4'
    >
      <CloseContent />
      <LargerContent />
      <SmallerContent />
      <Search />
    </div>
  </div>
  </div>
  <svelte:fragment
    slot="mobile"
  >
    {#if $giState.withGraph}
      <MobileToolbar />
    {/if}
  </svelte:fragment>
</Adaptive>
