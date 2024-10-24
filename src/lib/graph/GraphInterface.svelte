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
      hoveredNote: null
    };
  }

  function createGraphState(pageData) {
    const { subscribe, update } = writable(extractGraphStateFromPageData(pageData));

    function hover(note) {
      update((values) => ({ ...values, hoveredNote: note }));
    }

    return { subscribe, update, hover };
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
