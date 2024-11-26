<script>
  import Toolbar from '../toolbar/Toolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Content from '$lib/note/Note.svelte';
  import ContentSlider from '$lib/ContentSlider.svelte';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import { setContext } from 'svelte';

  export let graphProps;

  function extractGraphStateFromPageData(pageData) {
    return {
      activeNote: pageData.note || null,
      hoveredNote: null,
      showConnections: true,
      showTagsGlow: true
    };
  }

  function createGraphState(pageData) {
    const { subscribe, update } = writable(extractGraphStateFromPageData(pageData));

    function hover(note) {
      update((values) => ({ ...values, hoveredNote: note }));
    }

    /** @param {boolean} flag */
    function showConnections(flag) {
      update((values) => ({ ...values, showConnections: flag }));
    }

    /** @param {boolean} flag */
    function showTagsGlow(flag) {
      update((values) => ({ ...values, showTagsGlow: flag }));
    }

    return { subscribe, update, hover, showConnections, showTagsGlow };
  }

  const graphState = createGraphState($page.data);

  $: if ($graphState.activeNote?.slug != $page.data.note?.slug) {
    graphState.update((values) => ({ ...values, activeNote: $page.data.note || null }));
  }

  setContext('graphState', graphState);
</script>

<GraphContainer {...graphProps} />
<ContentSlider>
  <Toolbar />
  <Content>
    <slot />
  </Content>
</ContentSlider>
