<script>
  import { onDestroy } from 'svelte';

  import { useAppState, TILES } from '$lib/state/keys.js';
  import { loadNote } from '$lib/notes_route.js';
  import NoteContent from '$lib/note/NoteContent.svelte';
  import TileHeader from './TileHeader.svelte';

  /**
   * One column of the content area: a header, and below it an independently
   * scrolling note.
   *
   * **Two sources of note data, and the difference matters for prerendering.**
   * The focused tile whose slug matches the route's note renders `<slot/>` —
   * the route's own `+page.svelte`, whose data the router already loaded. That
   * is what puts the real note into the prerendered HTML. Every other tile
   * loads its own JSON through `loadNote`; vite's module cache makes a repeat
   * load free.
   *
   * At most one tile may take the slot. `ContentPane` computes `takesSlot` for
   * exactly one of them; two tiles rendering the same slot content would mount
   * the route's page twice.
   */

  /** @type {import('$lib/state/tiles.js').Tile} */
  export let tile;

  /** This tile's position, for `tiles.focus`. @type {number} */
  export let index;

  /** @type {boolean} */
  export let focused = false;

  /** Whether to render the route's page rather than loading the note. @type {boolean} */
  export let takesSlot = false;

  /**
   * Marks the focused column. Suppressed at one column, where there is nothing
   * to distinguish it from.
   *
   * @type {boolean}
   */
  export let showFocus = false;

  /**
   * Hands this tile's scroll container to the pane's scroll memory. Returns
   * its own de-registration function.
   *
   * @type {(id: string, el: HTMLElement) => () => void}
   */
  export let register;

  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));

  /** @type {HTMLElement | undefined} */
  let scroller;

  /** @type {(() => void) | null} */
  let unregister = null;

  // `bind:this` lands after mount, so this cannot be an `onMount` body. The
  // element is stable for the tile's lifetime, but re-registering defensively
  // costs nothing and keeps the memory honest if that ever stops being true.
  $: if (scroller) {
    unregister?.();
    unregister = register(tile.id, scroller);
  }

  onDestroy(() => unregister?.());

  function takeFocus() {
    tiles.focus(index);
  }
</script>

<div
  class="flex-1 min-w-0 h-full flex flex-col
         {showFocus && focused
    ? 'ring-1 ring-inset ring-emphasis-light dark:ring-emphasis-dark'
    : ''}"
  on:pointerdown={takeFocus}
  on:focusin={takeFocus}
>
  <TileHeader {tile} {focused} />

  <!--
    The scroll container. `min-h-0` is what lets it shrink inside the flex
    column; without it the box grows to its content and nothing ever scrolls.
  -->
  <div bind:this={scroller} class="flex-1 min-h-0 overflow-y-auto">
    <!--
      The `{#key}` is *inside* the scroller, and that is the whole fix. It is
      still needed — `WithHoverableLinks` re-wires its listeners in `onMount`,
      so it has to be torn down per note — but keying the scroller itself (what
      `note/Note.svelte` used to do) recreated the box on every navigation, and
      a box that did not exist a moment ago has no scroll position to restore.
    -->
    {#key tile.slug}
      {#if takesSlot}
        <slot />
      {:else}
        {#await loadNote(tile.slug)}
          <p class="p-6 text-sm text-muted-light dark:text-muted-dark">Loading …</p>
        {:then note}
          <NoteContent {note} />
        {:catch}
          <p class="p-6 text-sm text-muted-light dark:text-muted-dark">
            Could not load <code>{tile.slug}</code>.
          </p>
        {/await}
      {/if}
    {/key}
  </div>
</div>
