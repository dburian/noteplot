<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext } from 'svelte';

  const graphState = getContext('graphState');
</script>

<DesktopToolbarButton on:click={() => graphState.showTagsGlow(!$graphState.showTagsGlow)}>
  O
</DesktopToolbarButton>
