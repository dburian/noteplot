<script>
  import { useAppState, VIZ } from '$lib/state/keys.js';
  import ToolbarItem from '$lib/toolbar/ToolbarItem.svelte';

  /**
   * The force graph's own two toggles, rendered into the toolbar by
   * `VizSection` after the switcher. They replace `buttons/ShowConnections` and
   * `buttons/ShowTagsGlow`, which wrote to the same store as `activeNote` —
   * these write to `viz.settings['force-graph']`, a slice nothing outside this
   * visualization reads.
   *
   * The id is a literal rather than an import from `./index.js`: that module
   * imports this component, and reaching back into it for a constant would make
   * the cycle real for no gain.
   */

  const ID = 'force-graph';

  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));

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
