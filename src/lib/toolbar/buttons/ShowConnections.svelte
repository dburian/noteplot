<script>
  import DesktopToolbarButton from '../DesktopToolbarButton.svelte';
  import { getContext } from 'svelte';

  const graphState = getContext('graphState');
</script>

<DesktopToolbarButton
  label={`${$graphState.showConnections ? 'Hide' : 'Show'} links`}
  on={$graphState.showConnections}
  activeColor="bg-teal-600 dark:bg-teal-500"
  defaultColor="bg-teal-800 dark:bg-teal-700"
  on:click={() => graphState.showConnections(!$graphState.showConnections)}
  >
  -
</DesktopToolbarButton>
