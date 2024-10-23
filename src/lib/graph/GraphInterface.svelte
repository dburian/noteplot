<script>
  import Toolbar from '../toolbar/Toolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Content from '$lib/note/Note.svelte';
  import { createGraphInterfaceState } from '$lib/stores/graphInterfaceState.js';
  import { getContext, setContext } from 'svelte';
  import { goto } from '$app/navigation';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let graphProps;

  const urlState = getContext('urlState');
  const giState = createGraphInterfaceState($urlState);
  $: giState.updateUrlState($urlState);
  $: {
    if (typeof window !== 'undefined') {
      if ($giState.contentWidth == 1.0 && !$urlState.fullContent) {
        goto('?fullContent', { replaceState: true });
      } else if ($giState.contentWidth == 0.0 && !$urlState.noContent) {
        goto('?noContent', { replaceState: true });
      } else if (
        ($giState.contentWidth > 0.0 && $urlState.noContent) ||
        ($giState.contentWidth < 1.0 && $urlState.fullContent)
      ) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('noContent');
        nextUrl.searchParams.delete('fullContent');
        goto(nextUrl, { replaceState: true });
      }
    }
  }

  setContext('graphInterfaceState', giState);
  const contentWidth = tweened($giState.contentWidth, {
    duration: 400,
    easing: cubicOut
  });

  $: if ($giState.contentWidth !== $contentWidth) contentWidth.set($giState.contentWidth)
</script>

<GraphContainer {...graphProps} />
<div
  class={`sm:fixed sm:top-0 sm:right-0 sm:border-l-black dark:sm:border-l-invert-white ${$giState.contentWidth > 0 && 'sm:border-l-2'}`}
  style={`width: ${$contentWidth * 100}vw; max-width: calc(100vw - 4.5rem)`}
>
  <Toolbar />
  <Content>
    <slot />
  </Content>
</div>
