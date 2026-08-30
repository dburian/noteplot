<script>
  import { onMount } from 'svelte';

  import OverlayEmpty from './OverlayEmpty.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import QueryDisplay from '$lib/search/QueryDisplay.svelte';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import SearchMatch from '$lib/search/SearchMatch.svelte';
  import { loadSearchIndex } from '$lib/search/lazy_index.js';
  import { useAppState, FILTER, LAYOUT, OVERLAY, PREFS, TILES } from '$lib/state/keys.js';
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
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));

  /** Seeded from `?q=`. @type {string} */
  let value = $overlay.query;

  /** @type {SearchBar} */
  let searchBar;

  /** @type {import('$lib/search/search_index.js').MiniSearchIndex | null} */
  let index = null;
  /**
   * Seeded from the store, not `null`: reopening while a filter is applied must
   * show that filter's parsed query, not an empty readout.
   *
   * @type {import('minisearch').Query | null}
   */
  let query = $filter.query;
  let searching = false;

  /** See `SearchOverlay` — two awaits per run, so runs can overtake each other. */
  let latest = 0;

  /** @param {string} searchString */
  async function run(searchString) {
    overlay.setQuery(searchString);

    const mine = ++latest;

    if (searchString === '') {
      query = null;
      searching = false;
      filter.clear();
      return;
    }

    searching = true;

    // Lazy on purpose: this is where `minisearch` and the plaintext of every
    // note are first pulled over the wire. See `search/lazy_index.js`.
    if (!index) index = await loadSearchIndex();

    const parsed = index.parseSearchString(searchString);

    // `addAllAsync` again — see ISSUES.md B4.
    await index.ready();
    if (mine !== latest) return;

    query = parsed;
    // **One** write, never a `setQuery` then a `setResults`: the pair made the
    // graph rebuild its filtered maps and redraw twice per keystroke
    // (ISSUES.md C11).
    filter.setQueryAndResults(parsed, index.search(parsed));
    searching = false;
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
   * @param {import('$lib/search/search_index.js').Match} match
   * @param {'focused'|'new'} where
   */
  function open(match, where) {
    openNote(tiles, layout, match.note.slug, { where });
    if (where === 'focused') overlay.close();
  }

  onMount(() => {
    // Reopening with the filter already applied must not re-run it — the store
    // holds the results, and a rerun would hand the graph a new array.
    if (value && $filter.results === null) run(value);
  });

  $: results = $filter.results;
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

  {#if $prefs.showMeta && query}
    <div class="px-4 pb-2"><QueryDisplay {query} margin="mb-0" /></div>
  {/if}

  {#if searching}
    <OverlayEmpty><p class="text-sm">searching …</p></OverlayEmpty>
  {:else if results && results.length > 0}
    <p class="px-4 pb-1 text-xs text-muted-light dark:text-muted-dark">
      {results.length}
      {results.length === 1 ? 'note' : 'notes'} shown in the visualization
    </p>
    {#each results as match (match.note.slug)}
      <SearchMatch
        {match}
        showMeta={$prefs.showMeta}
        on:open={(ev) => open(match, ev.detail.where)}
      />
    {/each}
  {:else if results}
    <OverlayEmpty><p class="text-sm">no match — the visualization is empty</p></OverlayEmpty>
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
