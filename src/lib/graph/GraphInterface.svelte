<script>
  import Toolbar from '../toolbar/Toolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Content from '$lib/note/Note.svelte';
  import ContentSlider from '$lib/ContentSlider.svelte';

  export let graphProps;
</script>

<GraphContainer {...graphProps} />
<ContentSlider>
  <Toolbar />
  <Content>
    <slot />
  </Content>
</ContentSlider>
