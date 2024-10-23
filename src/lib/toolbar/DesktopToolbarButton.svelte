<script>
  import ToolbarButton from './ToolbarButton.svelte';
</script>

<ToolbarButton sizeClasses={'w-10 h-10'} on:click on:mousedown>
  <slot />
</ToolbarButton>
