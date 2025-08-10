<script>
  import DesktopToolbar from '../toolbar/DesktopToolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Content from '$lib/note/Note.svelte';
  import ContentSlider from '$lib/ContentSlider.svelte';

  export let graphProps;
</script>

<GraphContainer {...graphProps} />
<ContentSlider>
  <DesktopToolbar />
  <Content>
    <slot />
  </Content>
</ContentSlider>
