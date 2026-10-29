<script>
  import { useAppState, VIZ } from '$lib/state/keys.js';
  import ToolbarItem from '$lib/toolbar/ToolbarItem.svelte';

  /**
   * The force graph's own two toggles, rendered into the toolbar by
   * `VizSection` after the switcher. They replace `buttons/ShowConnections` and
   * `buttons/ShowTagsGlow`, which wrote to the same store as `activeNote` —
   * these write to the active visualization's slice of `viz.settings`, which
   * nothing outside that visualization reads.
   *
   * The active id, not a fixed one: the link, tag and date graphs all render
   * these controls, and each keeps its own settings. A hard-coded
   * `'force-graph'` made the toggles on the other two change the link graph.
   */

  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));

  $: ID = $viz.activeId;

  /**
   * The store's settings slice is a `Record<string, unknown>` — it is generic
   * over every visualization — so this is where it becomes the force graph's
   * own shape.
   *
   * @param {Record<string, unknown> | undefined} raw
   * @returns {import('./canvas_graph.js').ForceGraphSettings}
   */
  function asSettings(raw) {
    return {
      showConnections: Boolean(raw?.showConnections),
      showTagsGlow: Boolean(raw?.showTagsGlow)
    };
  }

  $: settings = asSettings($viz.settings[ID]);
</script>

<ToolbarItem
  label="Connections"
  title={`${settings.showConnections ? 'Hide' : 'Show'} links between notes`}
  active={settings.showConnections}
  activeColor="bg-amber-600 text-back-light dark:bg-amber-500 dark:text-back-dark"
  on:click={() => viz.updateSettings(ID, { showConnections: !settings.showConnections })}
/>
<ToolbarItem
  label="Tag glow"
  title={`${settings.showTagsGlow ? 'Hide' : 'Show'} the tag colour cloud around each note`}
  active={settings.showTagsGlow}
  activeColor="bg-fuchsia-600 text-back-light dark:bg-fuchsia-500 dark:text-back-dark"
  on:click={() => viz.updateSettings(ID, { showTagsGlow: !settings.showTagsGlow })}
/>
