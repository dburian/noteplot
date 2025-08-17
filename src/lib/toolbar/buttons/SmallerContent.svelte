<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext } from 'svelte';

  const contentSlider = getContext('contentSliderState');
  const contentState = getContext('contentState')
</script>

{#if $contentState.hasContent && !$contentState.noContent}
  <DesktopToolbarButton
    activeColor="bg-orange-600 dark:bg-orange-500"
    defaultColor="bg-orange-800 dark:bg-orange-700"
    label="Shrink content"
    on:click={() => contentSlider.smaller()}
  >
    {'>'}
  </DesktopToolbarButton>
{/if}
