<script>
  import { page } from '$app/stores';

  import { useAppState, NOTES_INDEX, TILES } from '$lib/state/keys.js';
  import OverlayHost from '$lib/overlay/OverlayHost.svelte';
  import { createScrollMemory } from './scroll_memory.js';
  import EmptyState from './EmptyState.svelte';
  import Tile from './Tile.svelte';
  import TileDivider from './TileDivider.svelte';

  /**
   * The content area: N columns side by side, each its own scroll container.
   *
   * The scrolling happens *per tile*, never on the window. That is why
   * `scroll_memory.js` exists — SvelteKit's own scroll restoration only ever
   * moves the window, so back/forward would otherwise always dump you at the
   * top of a note.
   *
   * `relative` is the anchor for `OverlayHost`: the search, filter and command
   * modals cover the content area and nothing else, so the toolbar stays
   * clickable and the visualization stays visible and usable underneath.
   */

  /** Flex sizing handed down by `AppShell`. @type {string} */
  export let style = '';

  /**
   * Whether `style` is hiding this pane (`viz` mode). The pane stays mounted so
   * the tiles keep their notes; this is the flag that says the boxes are about
   * to go away, so their scroll offsets have to be carried across by hand.
   *
   * @type {boolean}
   */
  export let hidden = false;

  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );

  /**
   * Mirrors the store so the scroll memory can read the focused tile *at
   * navigation time*, which is not the same tile as when this ran.
   *
   * @type {import('$lib/state/tiles.js').TilesState}
   */
  let current = { tiles: [], focusIndex: 0 };
  $: current = $tiles;

  const scroll = createScrollMemory({
    focusedId: () => current.tiles[current.focusIndex]?.id ?? null
  });

  /**
   * Carry the tiles' scroll offsets across a hide.
   *
   * A reactive block and not `$: if (hidden) ...` inline, because the *order*
   * is the whole trick: Svelte runs these before it patches the DOM, so the
   * snapshot happens while the scroll boxes still exist, and the restore —
   * which awaits a `tick` — happens after they have been laid out again.
   *
   * @type {(() => Promise<void>) | null}
   */
  let release = null;
  $: onHiddenChange(hidden);

  /** @param {boolean} isHidden */
  function onHiddenChange(isHidden) {
    if (isHidden) {
      release = scroll.hold();
    } else if (release) {
      const restore = release;
      release = null;
      restore();
    }
  }

  /**
   * `document.title` is owned here, not by `NoteContent`, because with N tiles
   * mounted several copies of that component would fight over it. Here there
   * is one title and it tracks the focused column — including when the focused
   * column is *not* the route's note, in which case no `+page.svelte` renders
   * at all and a route-level `<title>` would go stale.
   *
   * The titles come from `__graph.json`, so this is correct during prerender
   * too.
   */
  $: focusedSlug = $tiles.tiles[$tiles.focusIndex]?.slug ?? null;
  $: focusedTitle = focusedSlug ? notesIndex.titleOf(focusedSlug) : null;

  /**
   * Which tile, if any, may render `<slot/>`. The route only loaded data for
   * its own note, so only a tile showing that note can use the page — and only
   * the focused one, since the path follows focus.
   */
  $: pageSlug = $page.data?.note?.slug ?? null;
  $: slotIndex =
    pageSlug !== null && $tiles.tiles[$tiles.focusIndex]?.slug === pageSlug
      ? $tiles.focusIndex
      : -1;
</script>

<svelte:head>
  <title>{focusedTitle ? `Noteplot | ${focusedTitle}` : 'Noteplot'}</title>
</svelte:head>

<div class="relative h-full min-w-0 flex flex-row" {style}>
  {#if $tiles.tiles.length === 0}
    <EmptyState />
  {:else}
    {#each $tiles.tiles as tile, i (tile.id)}
      {#if i > 0}
        <TileDivider />
      {/if}
      <Tile
        {tile}
        index={i}
        focused={i === $tiles.focusIndex}
        showFocus={$tiles.tiles.length > 1}
        takesSlot={i === slotIndex}
        register={scroll.register}
      >
        <slot />
      </Tile>
    {/each}
  {/if}

  <OverlayHost />
</div>
