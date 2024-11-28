<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext } from 'svelte';

  const graphState = getContext('graphState');
</script>

<DesktopToolbarButton
  label={`${graphState.showTagsGlow ? 'Hide' : 'Show'} tags glow`}
  activeColor="bg-sky-600 dark:bg-sky-500"
  defaultColor="bg-sky-800 dark:bg-sky-700"
  on={$graphState.showTagsGlow}
  on:click={() => graphState.showTagsGlow(!$graphState.showTagsGlow)}
  >
  O
</DesktopToolbarButton>
