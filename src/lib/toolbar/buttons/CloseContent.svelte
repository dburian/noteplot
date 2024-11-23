<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';

  const contentSlider = getContext('contentSliderState');
</script>

{#if $contentSlider.hasContent}
  <DesktopToolbarButton on:click={() => goto('/')}>x</DesktopToolbarButton>
{/if}
