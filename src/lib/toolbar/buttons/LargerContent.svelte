<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext} from 'svelte';

  const contentSlider = getContext('contentSliderState');
  const contentState = getContext('contentState')
</script>

{#if $contentState.hasContent && !$contentState.onlyContent}
  <DesktopToolbarButton
    activeColor="bg-amber-600 dark:bg-amber-500"
    defaultColor="bg-amber-800 dark:bg-amber-700"
    label="Enlarge content"
    on:click={() => contentSlider.larger()}
    >
    {'<'}
  </DesktopToolbarButton>
{/if}
