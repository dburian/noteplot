<script>
  import { useAppState, FILTER, LAYOUT, OVERLAY, PREFS, TILES } from '$lib/state/keys.js';
  import ToolbarItem from './ToolbarItem.svelte';

  /**
   * Everything about the content area: the three overlays, the metadata
   * toggle, and the two tile operations.
   *
   * The three buttons only flip `overlay.kind`; `overlay/OverlayHost.svelte`
   * reads it and mounts the screen, and the URL's `?overlay=` follows. That is
   * the whole contract — these buttons and the keyboard shortcuts in `AppShell`
   * are interchangeable ways of writing one field.
   *
   * **Metadata** is broader than its name: it shows a note's frontmatter and
   * backlinks *and* the parsed-query readout in the search and filter overlays.
   * Both answer "show me the machinery".
   *
   * Search and Filter shared one identical magnifier SVG in the old vertical
   * strip, where they were far enough apart for nobody to notice. They are
   * adjacent now; until an icon set exists they are plain distinct words.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));

  // Closing the filter overlay does not clear the filter, so "is the overlay
  // open" and "is a filter in force" are different questions. The badge answers
  // the second one.
  $: filterActive = $filter.query !== null;

  // Both tile operations act on the focused column, so both are absent when
  // there is none. `tiles.splitRight` is a no-op at zero tiles anyway; hiding
  // the button keeps the strip from offering a control that does nothing.
  $: focused = $tiles.tiles[$tiles.focusIndex] ?? null;

  // This button is in the strip, which is on screen in every mode — so it can
  // be pressed while the content pane is hidden, where a new column would be
  // invisible. `reveal()` is a no-op unless the mode is `viz`.
  function splitRight() {
    tiles.splitRight();
    layout.reveal();
  }
</script>

<div class="flex items-center gap-1 shrink-0">
  <ToolbarItem
    label="Search"
    title="Search notes"
    active={$overlay.kind === 'search'}
    activeColor="bg-green-600 text-back-light dark:bg-green-500 dark:text-back-dark"
    on:click={() => overlay.toggle('search')}
  />
  <ToolbarItem
    label="Filter"
    title={filterActive ? 'Filter notes (a filter is active)' : 'Filter notes'}
    active={$overlay.kind === 'filter'}
    activeColor="bg-emerald-600 text-back-light dark:bg-emerald-500 dark:text-back-dark"
    on:click={() => overlay.toggle('filter')}
  >
    {#if filterActive}
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true"
      ></span>
    {/if}
  </ToolbarItem>
  <ToolbarItem
    label="Commands"
    title="Command palette"
    active={$overlay.kind === 'commands'}
    activeColor="bg-violet-600 text-back-light dark:bg-violet-500 dark:text-back-dark"
    on:click={() => overlay.toggle('commands')}
  />

  <div class="w-px h-5 mx-1 bg-muted-light dark:bg-muted-dark" aria-hidden="true"></div>

  <ToolbarItem
    label="Metadata"
    title={`${$prefs.showMeta ? 'Hide' : 'Show'} note metadata and parsed queries`}
    active={$prefs.showMeta}
    activeColor="bg-sky-600 text-back-light dark:bg-sky-500 dark:text-back-dark"
    on:click={prefs.toggleMeta}
  />
  {#if focused}
    <ToolbarItem
      label="Split"
      title="Split the focused note into a new column"
      on:click={splitRight}
    />
    <ToolbarItem
      label="Close"
      title="Close the focused note"
      activeColor="bg-red-600 text-back-light dark:bg-red-500 dark:text-back-dark"
      on:click={() => tiles.close(focused.id)}
    />
  {/if}
</div>
