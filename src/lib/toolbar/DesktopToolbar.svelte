<script>
  import {getContext} from 'svelte';
  import ResizeContent from './buttons/ResizeContent.svelte';
  import Search from './buttons/Search.svelte';
  import LargerContent from './buttons/LargerContent.svelte';
  import SmallerContent from './buttons/SmallerContent.svelte';
    import CloseContent from './buttons/CloseContent.svelte';
    import Filter from './buttons/Filter.svelte';
    import ShowConnections from './buttons/ShowConnections.svelte';
    import ShowTagsGlow from './buttons/ShowTagsGlow.svelte';

  // `hasContent` lives on `contentState`, not on the slider store — guarding on
  // the slider meant the handle never rendered (ISSUES.md B5).
  const contentState = getContext('contentState');
</script>

<div class="absolute">
  <div class="relative left-[-100%] mt-4 mx-4">
    <div class="grid auto-rows-max gap-y-4">
      <CloseContent />
      <LargerContent />
      <SmallerContent />
      <Search />
      <Filter />
      <ShowConnections />
      <ShowTagsGlow />
    </div>
  </div>
</div>
{#if $contentState.hasContent}
  <ResizeContent />
{/if}
