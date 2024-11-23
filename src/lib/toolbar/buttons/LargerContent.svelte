<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext} from 'svelte';

  const contentSlider = getContext('contentSliderState');
</script>

{#if $contentSlider.hasContent && !$contentSlider.fullContent}
  <DesktopToolbarButton on:click={() => contentSlider.larger()}>
    {'<'}
  </DesktopToolbarButton>
{/if}
