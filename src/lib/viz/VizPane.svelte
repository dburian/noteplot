<script>
  import { useAppState, LAYOUT, NOTES_INDEX, SELECTION, TILES, VIZ } from '$lib/state/keys.js';
  import { openNote } from '$lib/state/navigate.js';
  import { toNoteRef } from '$lib/state/selection.js';
  import { getVisualization } from './registry.js';
  import { getVizData } from './data.js';

  /**
   * The visualization host: a registry lookup and the active descriptor's
   * `View`.
   *
   * The pane is a genuine flex child sized by its parent, which is the whole
   * point — the canvas inside measures itself from its own element rather than
   * from the window, and needs no inset.
   *
   * **Swapping visualizations is destroy-and-recreate**, keyed on the
   * descriptor's `id`. `<svelte:component>` alone would not do it: the link and
   * tag graphs share one `View`, so switching between them leaves `this`
   * unchanged and the `CanvasGraph` built in `onMount` -- which has no update
   * path from props -- would keep drawing the old graph.
   */

  /** Flex sizing handed down by `AppShell`. @type {string} */
  export let style = '';

  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );

  $: active = getVisualization($viz.activeId);

  /**
   * The active visualization's own generated file, loaded here rather than by
   * a route so only the visualization on screen is fetched, and so `AppShell`
   * stays a pure layout component with no data to forward. `getVizData`
   * returns a stable reference per id, which the `{#await}` below needs.
   */
  $: data = active.dataId ? getVizData(active.dataId) : {};

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
    /**
     * Only notes open. A graph may hold nodes that are not notes -- the tag
     * graph's tags -- and opening one would put a 404 into a column.
     *
     * @param {string} slug
     */
    onActivate: (slug) => {
      if (notesIndex.bySlug.has(slug)) openNote(tiles, layout, slug);
    },
    /** @param {{slug: string, title: string} | null} node */
    onHover: (node) => selection.hover(toNoteRef(node))
  };
</script>

<div class="relative h-full min-w-0 overflow-hidden" {style}>
  {#if active.View}
    {#key active.id}
      {#await data then resolved}
        <svelte:component this={active.View} data={resolved} {settings} {callbacks} />
      {:catch error}
        <div
          class="grid h-full place-content-center text-sm select-none
                 text-muted-light dark:text-muted-dark"
        >
          {error.message}
        </div>
      {/await}
    {/key}
  {:else}
    <div
      class="grid h-full place-content-center text-sm select-none
             text-muted-light dark:text-muted-dark"
    >
      {active.label} has no view
    </div>
  {/if}
</div>
