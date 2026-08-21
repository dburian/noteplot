<script>
  import WithAppState from '$lib/state/WithAppState.svelte';
  import AppShell from '$lib/shell/AppShell.svelte';
  import { visualizations } from '$lib/viz/registry.js';

  export let data;
</script>

<WithAppState nodes={data.nodes} vizDescriptors={visualizations}>
  <AppShell>
    <slot />
  </AppShell>
</WithAppState>
