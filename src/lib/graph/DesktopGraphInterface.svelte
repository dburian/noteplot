<script>
  import DesktopToolbar from '../toolbar/DesktopToolbar.svelte';
  import GraphContainer from './GraphContainer.svelte';
  import Content from '$lib/note/Note.svelte';
  import ContentSlider from '$lib/ContentSlider.svelte';
  import WithContentSliderState from '$lib/content/WithContentSliderState.svelte';

  export let graphProps;
</script>

<!-- The provider wraps *both* children: the canvas insets itself by the pane's
     width, and context does not flow sideways. -->
<WithContentSliderState>
  <GraphContainer {...graphProps} />
  <ContentSlider>
    <DesktopToolbar />
    <Content>
      <slot />
    </Content>
  </ContentSlider>
</WithContentSliderState>
