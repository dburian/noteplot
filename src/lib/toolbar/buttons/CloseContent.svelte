<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';
    import { base } from '$app/paths';

  const contentSlider = getContext('contentSliderState');
</script>

{#if $contentSlider.hasContent}
  <DesktopToolbarButton
    activeColor="bg-red-600 dark:bg-red-500"
    defaultColor="bg-red-800 dark:bg-red-700"
    label="Close note"
    on:click={() => goto(`${base}/`)}>
    x
  </DesktopToolbarButton>
{/if}
