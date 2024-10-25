<script>
  import DesktopToolbarButton from './DesktopToolbarButton.svelte';
  import { goto } from '$app/navigation';
  import { getContext} from 'svelte';
    import ResizeContent from './buttons/ResizeContent.svelte';
    import Search from './buttons/Search.svelte';

  const contentSlider = getContext('contentSliderState');


</script>

<div class="absolute">
  <div class="relative left-[-100%] mt-4 mx-4">
    <div class="grid auto-rows-max gap-y-4">
      {#if $contentSlider.hasContent}
        <DesktopToolbarButton on:click={() => goto('/')}>x</DesktopToolbarButton>
      {/if}
      {#if $contentSlider.hasContent && !$contentSlider.fullContent}
        <DesktopToolbarButton on:click={() => contentSlider.larger()}>
          {'<'}
        </DesktopToolbarButton>
      {/if}
      {#if $contentSlider.hasContent && !$contentSlider.noContent}
        <DesktopToolbarButton on:click={() => contentSlider.smaller()}>
          {'>'}
        </DesktopToolbarButton>
      {/if}
      <Search />
    </div>
  </div>
  </div>
{#if $contentSlider.hasContent}
  <ResizeContent />
{/if}
