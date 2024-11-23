<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext } from 'svelte';

  const contentSlider = getContext('contentSliderState');
</script>

{#if $contentSlider.hasContent && !$contentSlider.noContent}
  <DesktopToolbarButton on:click={() => contentSlider.smaller()}>
    {'>'}
  </DesktopToolbarButton>
{/if}
