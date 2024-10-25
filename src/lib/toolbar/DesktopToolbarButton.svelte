<script>
  import ToolbarButton from './ToolbarButton.svelte';
</script>

<ToolbarButton class={'w-8 h-8'} on:click on:mousedown>
  <slot />
</ToolbarButton>
