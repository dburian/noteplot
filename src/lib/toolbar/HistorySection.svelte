<script>
  import { useAppState, HISTORY, TILES } from '$lib/state/keys.js';
  import { openNote } from '$lib/state/navigate.js';
  import ToolbarItem from './ToolbarItem.svelte';

  /**
   * The last few notes viewed, most recent first, as a horizontally scrollable
   * row of chips.
   *
   * This is the section that absorbs the slack in the strip, so `flex-1
   * min-w-0` is load-bearing: without `min-w-0` a flex item refuses to shrink
   * below its content's intrinsic width, and the row pushes `ContentSection`
   * off the right edge instead of scrolling. Both live here rather than at the
   * call site, so the sizing cannot be forgotten by whoever mounts it.
   */

  const history = /** @type {import('$lib/state/history.js').HistoryStore} */ (
    useAppState(HISTORY)
  );
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));

  $: focusedSlug = $tiles.tiles[$tiles.focusIndex]?.slug ?? null;

  /** @param {MouseEvent} ev @param {string} slug */
  function onClick(ev, slug) {
    openNote(tiles, slug, { where: ev.altKey ? 'new' : 'focused' });
  }

  /**
   * Middle-click opens in a new column, matching what it does to a link
   * everywhere else. `preventDefault` suppresses the autoscroll cursor.
   *
   * @param {MouseEvent} ev @param {string} slug
   */
  function onAuxClick(ev, slug) {
    if (ev.button !== 1) return;
    ev.preventDefault();
    openNote(tiles, slug, { where: 'new' });
  }
</script>

<div class="chips flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
  {#each $history.recent as note (note.slug)}
    <ToolbarItem
      title={`${note.title} — click to open, Alt- or middle-click for a new column`}
      active={note.slug === focusedSlug}
      activeColor="bg-front-light text-back-light dark:bg-front-dark dark:text-back-dark"
      on:click={(ev) => onClick(ev, note.slug)}
      on:auxclick={(ev) => onAuxClick(ev, note.slug)}
    >
      <span class="block max-w-[12rem] truncate">{note.title}</span>
    </ToolbarItem>
  {/each}
</div>

<style>
  /* Tailwind ships no scrollbar-hiding utility, and a visible scrollbar inside
     a 2.5rem strip eats most of the chips' height. */
  .chips {
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
</style>
