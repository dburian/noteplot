<script>
  import { createEventDispatcher, getContext } from 'svelte';
  import ToolbarButton from '../ToolbarButton.svelte';
    import { goto } from '$app/navigation';

  const urlState = getContext('urlState');
  const dispatcher = createEventDispatcher();
</script>

