<script>
  import {getContext} from 'svelte';
  import ResizeContent from './buttons/ResizeContent.svelte';
  import Search from './buttons/Search.svelte';
  import LargerContent from './buttons/LargerContent.svelte';
  import SmallerContent from './buttons/SmallerContent.svelte';
    import CloseContent from './buttons/CloseContent.svelte';
    import Filter from './buttons/Filter.svelte';

  const contentSlider = getContext('contentSliderState');
</script>

<div class="absolute">
  <div class="relative left-[-100%] mt-4 mx-4">
    <div class="grid auto-rows-max gap-y-4">
      <CloseContent />
      <LargerContent />
      <SmallerContent />
      <Search />
      <Filter />
    </div>
  </div>
  </div>
{#if $contentSlider.hasContent}
  <ResizeContent />
{/if}
