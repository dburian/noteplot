<script>
  import { onDestroy, onMount } from 'svelte';

  import OverlayEmpty from './OverlayEmpty.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import QueryDisplay from '$lib/search/QueryDisplay.svelte';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import SearchMatch from '$lib/search/SearchMatch.svelte';
  import { parseSearchString } from '$lib/search/query.js';
  import { toNoteRef } from '$lib/state/selection.js';
  import { getSearchClient, PAGE } from '$lib/search/search_client.js';
  import {
    useAppState,
    FILTER,
    LAYOUT,
    NOTES_INDEX,
    OVERLAY,
    PREFS,
    SELECTION,
    TILES
  } from '$lib/state/keys.js';
  import { openNote } from '$lib/state/navigate.js';

  /**
   * Restrict the visualization to the notes that match. Not a way to *pick* a
   * note, which is what makes it a different screen from the search overlay
   * rather than a flag on it:
   *
   * - the result of a filter is what the graph shows, so the list here is a
   *   preview of that, not a menu — there is no ↑/↓ cursor;
   * - **Enter applies without closing.** The filter is already applied as you
   *   type; Enter only skips the rest of the debounce, and you stay put so you
   *   can watch the graph change and keep refining;
   * - **closing does not clear the filter.** That is what the toolbar's filter
   *   badge and the "Clear filter" command are for.
   *
   * The graph gets **every** match; the preview lists `PAGE` rows at a time.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );
  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );

  /**
   * The applied filter's text when there is one — `?filter=` on a reload
   * reopens with it — else `?q=`.
   *
   * @type {string}
   */
  let value = $filter.text || $overlay.query;

  /** @type {SearchBar} */
  let searchBar;

  let searching = false;
  let indexing = false;
  let failed = false;

  /** Only the newest run may touch the flags above; `filter.apply` orders the results themselves. */
  let runs = 0;

  /** @param {string} searchString */
  async function run(searchString) {
    overlay.setQuery(searchString);
    const mine = ++runs;
    shown = PAGE;

    if (!parseSearchString(searchString)) {
      searching = false;
      failed = false;
      filter.clear();
      return;
    }

    searching = true;
    indexing = !getSearchClient(notesIndex).ready;
    try {
      await filter.apply(searchString);
      if (mine !== runs) return;
      failed = false;
    } catch (err) {
      if (mine !== runs) return;
      console.error(err);
      failed = true;
    }
    searching = false;
    indexing = false;
  }

  $: results = $filter.results;

  let shown = PAGE;

  /**
   * The results the list shows: `$filter.results` once the snippets for its
   * visible rows have arrived. Lagging by that one worker round trip means
   * the old rows stay up while the next query runs, and new rows never render
   * without their excerpt and then jump.
   *
   * @type {import('$lib/search/search_client.js').Match[] | null}
   */
  let displayed = null;

  /**
   * Local, not in the store: they are the preview's, and the store's `results`
   * must keep its identity (the graph compares it by reference).
   *
   * @type {import('$lib/search/search_client.js').Snippets}
   */
  let snippets = {};

  // Reactive on the store rather than driven from `run`, because a filter can
  // also change under an open overlay: `?filter=` on back/forward.
  $: preview(results, shown);

  /**
   * @param {import('$lib/search/search_client.js').Match[] | null} rows
   * @param {number} count
   */
  async function preview(rows, count) {
    if (!rows) {
      displayed = null;
      return;
    }
    // Snippets depend on the query's terms, so a new result set starts over.
    const have = rows === displayed ? snippets : {};
    const missing = rows.slice(0, count).filter((m) => !have[m.note.slug]);
    const more = missing.length
      ? await getSearchClient(notesIndex)
          .snippets(missing)
          .catch(() => ({}))
      : {};
    if (rows !== results) return;
    snippets = { ...have, ...more };
    displayed = rows;
  }

  function showMore() {
    shown += PAGE;
  }

  /** @param {KeyboardEvent} ev */
  function onKeydown(ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    // Apply what is typed *now* rather than waiting out the debounce. `flush`
    // is a no-op when nothing is owed, so holding Enter does not re-filter.
    searchBar.flush();
  }

  /**
   * A row is still a link to a note — the preview is the obvious place to
   * notice the thing you were after. Following one leaves the filter in force.
   *
   * @param {import('$lib/search/search_client.js').Match} match
   * @param {'focused'|'new'} where
   */
  function open(match, where) {
    openNote(tiles, layout, match.note.slug, { where });
    if (where === 'focused') overlay.close();
  }

  /**
   * Hovering a row highlights its node, as hovering a link in a note does. The
   * filter's rows have no keyboard cursor, so only the pointer drives it.
   *
   * @param {import('$lib/search/search_client.js').Match | null} match
   */
  function hover(match) {
    selection.hover(toNoteRef(match?.note));
  }

  onMount(() => {
    // Start building the index now, while the query is being typed, rather
    // than after the first debounce. See `search_client.js`.
    getSearchClient(notesIndex);
    // Reopening with the filter already applied must not re-run it — the store
    // holds the results, and a rerun would hand the graph a new array.
    if (value && $filter.results === null) run(value);
  });

  // Closing with the pointer on a row must not leave its node lit.
  onDestroy(() => hover(null));
</script>

<OverlayShell title="Filter notes" on:close={overlay.close}>
  <SearchBar
    slot="input"
    bind:this={searchBar}
    bind:value
    placeholder="Filter notes"
    on:search={(ev) => run(ev.detail.searchString)}
    on:keydown={onKeydown}
  />

  {#if $prefs.showMeta && $filter.query}
    <div class="px-4 pb-2"><QueryDisplay query={$filter.query} margin="mb-0" /></div>
  {/if}

  <!-- The old list stays up while the next query runs; see `displayed`. -->
  {#if failed}
    <OverlayEmpty><p class="text-sm">search failed — see the browser console</p></OverlayEmpty>
  {:else if displayed && displayed.length > 0}
    <p class="px-4 pb-1 text-xs text-muted-light dark:text-muted-dark">
      {displayed.length}
      {displayed.length === 1 ? 'note' : 'notes'} shown in the visualization
    </p>
    {#each displayed.slice(0, shown) as match (match.note.slug)}
      <SearchMatch
        {match}
        snippet={snippets[match.note.slug]}
        showMeta={$prefs.showMeta}
        on:open={(ev) => open(match, ev.detail.where)}
        on:mouseenter={() => hover(match)}
        on:mouseleave={() => hover(null)}
      />
    {/each}
    {#if displayed.length > shown}
      <button
        class="w-full px-4 py-3 text-left text-sm text-muted-light dark:text-muted-dark
               hover:text-front-light dark:hover:text-front-dark"
        on:click={showMore}
      >
        show {Math.min(PAGE, displayed.length - shown)} more of {displayed.length - shown}
      </button>
    {/if}
  {:else if displayed}
    <OverlayEmpty><p class="text-sm">no match — the visualization is empty</p></OverlayEmpty>
  {:else if searching || results}
    <OverlayEmpty>
      <p class="text-sm">{indexing ? 'indexing notes …' : 'searching …'}</p>
    </OverlayEmpty>
  {:else}
    <OverlayEmpty>
      <p class="text-sm">Narrow the visualization to matching notes.</p>
      <p class="text-xs">Clearing the box removes the filter.</p>
    </OverlayEmpty>
  {/if}

  <footer
    slot="footer"
    class="shrink-0 truncate px-3 py-1.5 text-xs text-muted-light dark:text-muted-dark
           border-t border-t-muted-light dark:border-t-muted-dark"
  >
    ↵ apply now · Esc close — the filter stays until you clear it
  </footer>
</OverlayShell>
