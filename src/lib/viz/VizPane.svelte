<script>
  import { page } from '$app/stores';

  import { useAppState, SELECTION, TILES, VIZ } from '$lib/state/keys.js';
  import { openNote } from '$lib/state/navigate.js';
  import { toNoteRef } from '$lib/state/selection.js';
  import { getVisualization } from './registry.js';

  /**
   * The visualization host: a registry lookup and the active descriptor's
   * `View`.
   *
   * The pane is a genuine flex child sized by its parent, which is the whole
   * point — the canvas inside measures itself from its own element rather than
   * from the window, and needs no inset.
   *
   * **Swapping visualizations is destroy-and-recreate.** `<svelte:component>`
   * remounts on change, which is exactly right: the force graph's `CanvasGraph`
   * is built once in `onMount` and has no update path from props.
   */

  /** Flex sizing handed down by `AppShell`. @type {string} */
  export let style = '';

  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );

  $: active = getVisualization($viz.activeId);

  /**
   * `__graph.json`, straight off the layout's `load`. Read here rather than
   * threaded down from `(app)/+layout.svelte` so `AppShell` stays a pure layout
   * component with no data to forward.
   */
  $: data = {
    nodes: $page.data?.nodes ?? [],
    links: $page.data?.links ?? [],
    viewBox: $page.data?.viewBox ?? null
  };

  // Falls back to the descriptor's own defaults: `viz.settings` is seeded from
  // localStorage, which can predate a visualization being registered.
  $: settings = $viz.settings[active.id] ?? active.defaultSettings;

  /**
   * The two things a visualization is allowed to do to the app, and the reason
   * it needs no router and no note-ref conversion of its own.
   *
   * A `const`, deliberately: the force graph captures this object once at mount
   * and a reactive rebuild would leave it holding a stale copy.
   */
  const callbacks = {
    /** @param {string} slug */
    onActivate: (slug) => {
      openNote(tiles, slug);
    },
    /** @param {{slug: string, title: string} | null} node */
    onHover: (node) => selection.hover(toNoteRef(node))
  };
</script>

<div class="relative h-full min-w-0 overflow-hidden" {style}>
  {#if active.View}
    <svelte:component this={active.View} {data} {settings} {callbacks} />
  {:else}
    <div
      class="grid h-full place-content-center text-sm select-none
             text-muted-light dark:text-muted-dark"
    >
      {active.label} has no view
    </div>
  {/if}
</div>
