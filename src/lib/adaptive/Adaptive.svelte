<script>
  import { getContext } from "svelte";

  const adaptive = getContext("adaptive")
</script>

{#if $adaptive.mobile}
  <slot name="mobile" />
{:else if $adaptive.desktop}
  <slot name="desktop" />
{/if}

