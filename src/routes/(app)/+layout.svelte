<script>
  import WithAppState from '$lib/state/WithAppState.svelte';
  import AppShell from '$lib/shell/AppShell.svelte';
  import { visualizations } from '$lib/viz/registry.js';

  export let data;
</script>

<!--
  No `<slot />`. The pages under this layout render nothing at all: the content
  pane's columns each render their own note from `notes_route.js`'s cache, which
  a page's `load` warms. That is what makes every column equal, and it is why a
  split no longer tears down the column that happened to hold the route's page.

  A page that does need markup of its own has to re-introduce a target for it --
  and pick a place in the shell to put it, which is exactly the decision this
  removed. See `src/routes/CLAUDE.md`.
-->
<WithAppState nodes={data.nodes} vizDescriptors={visualizations}>
  <AppShell />
</WithAppState>
