<script>
  import { useAppState, NOTES_INDEX, TILES } from '$lib/state/keys.js';
  import Button from '$lib/components/Button.svelte';

  /**
   * A tile's title bar: which note this column holds, and a close button.
   *
   * The title comes from `NOTES_INDEX` (built from `__graph.json`) rather than
   * from the note's own JSON, so the header is right immediately — before a new
   * column's `getNote` has resolved, and without a second copy of the note's
   * data.
   */

  /** @type {import('$lib/state/tiles.js').Tile} */
  export let tile;

  /** @type {boolean} */
  export let focused = false;

  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );

  $: title = notesIndex.titleOf(tile.slug);
</script>

<div
  class="shrink-0 flex items-center gap-2 px-3 h-8 border-b
         border-muted-light dark:border-muted-dark
         {focused ? 'text-emphasis-light dark:text-emphasis-dark' : ''}"
>
  <span class="min-w-0 flex-1 truncate text-sm select-none" {title}>{title}</span>
  <Button
    title="Close this column"
    class="shrink-0 px-1 leading-none rounded text-muted-light dark:text-muted-dark
           hover:text-emphasis-light dark:hover:text-emphasis-dark"
    on:click={() => tiles.close(tile.id)}
  >
    <span aria-hidden="true">✕</span>
    <span class="sr-only">Close {title}</span>
  </Button>
</div>
