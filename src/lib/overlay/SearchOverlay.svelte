<script>
  import { onMount } from 'svelte';

  import OverlayEmpty from './OverlayEmpty.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import QueryDisplay from '$lib/search/QueryDisplay.svelte';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import SearchMatch from '$lib/search/SearchMatch.svelte';
  import { loadSearchIndex } from '$lib/search/lazy_index.js';
  import { useAppState, LAYOUT, OVERLAY, PREFS, TILES } from '$lib/state/keys.js';
  import { openNote } from '$lib/state/navigate.js';

  /**
   * Find a note and open it. What the `/search` route used to be, minus the
   * route: it opens over whatever you are reading instead of replacing it.
   *
   * Keyboard-first — ↑/↓ move the cursor, Enter opens in the focused column,
   * Alt+Enter in a new one, Escape closes (handled by `AppShell`).
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));

  /** Seeded from `?q=`, so a shared search URL opens with its results. */
  let value = $overlay.query;

  /** @type {import('$lib/search/search_index.js').MiniSearchIndex | null} */
  let index = null;
  /** @type {import('minisearch').Query | null} */
  let query = null;
  /** `null` means "nothing has been searched yet", which is not "no match". */
  let results = /** @type {import('$lib/search/search_index.js').Match[] | null} */ (null);
  let searching = false;
  let highlight = 0;

  /**
   * Monotonic run counter. Every search awaits twice — the lazy `search.json`
   * import and `index.ready()` — so two keystrokes can be in flight at once and
   * nothing orders their resolutions. Only the newest run may write `results`.
   */
  let latest = 0;

  /** @param {string} searchString */
  async function run(searchString) {
    // Keeps `?q=` in step. Already debounced: `SearchBar` only dispatches once
    // the typing stops, so this is not a `replaceState` per keystroke.
    overlay.setQuery(searchString);

    const mine = ++latest;

    if (searchString === '') {
      query = null;
      results = null;
      searching = false;
      return;
    }

    searching = true;

    // Lazy on purpose: this is where `minisearch` and the plaintext of every
    // note are first pulled over the wire. See `search/lazy_index.js`.
    if (!index) index = await loadSearchIndex();

    const parsed = index.parseSearchString(searchString);

    // The index is built with `addAllAsync`, so a query typed straight after
    // the overlay opens outruns it and matches nothing (ISSUES.md B4). This
    // await is also what the "searching …" state is showing.
    await index.ready();
    if (mine !== latest) return;

    query = parsed;
    results = index.search(parsed);
    highlight = 0;
    searching = false;
  }

  /**
   * @param {import('$lib/search/search_index.js').Match} match
   * @param {'focused'|'new'} where
   */
  function open(match, where) {
    openNote(tiles, layout, match.note.slug, { where });
    // Alt+Enter leaves the overlay up: opening several notes into their own
    // columns is one gesture repeated, and closing between each would make it
    // three.
    if (where === 'focused') overlay.close();
  }

  /** @param {KeyboardEvent} ev */
  function onKeydown(ev) {
    const count = results?.length ?? 0;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (count) highlight = (highlight + 1) % count;
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (count) highlight = (highlight - 1 + count) % count;
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const match = results?.[highlight];
      if (match) open(match, ev.altKey ? 'new' : 'focused');
    }
  }

  onMount(() => {
    if (value) run(value);
  });
</script>

<OverlayShell title="Search notes" on:close={overlay.close}>
  <SearchBar
    slot="input"
    bind:value
    placeholder="Search notes"
    on:search={(ev) => run(ev.detail.searchString)}
    on:keydown={onKeydown}
  />

  {#if $prefs.showMeta && query}
    <div class="px-4 pb-2"><QueryDisplay {query} margin="mb-0" /></div>
  {/if}

  {#if searching}
    <OverlayEmpty><p class="text-sm">searching …</p></OverlayEmpty>
  {:else if results && results.length > 0}
    {#each results as match, i (match.note.slug)}
      <SearchMatch
        {match}
        active={i === highlight}
        showMeta={$prefs.showMeta}
        on:open={(ev) => open(match, ev.detail.where)}
        on:mouseenter={() => (highlight = i)}
      />
    {/each}
  {:else if results}
    <OverlayEmpty><p class="text-sm">no match</p></OverlayEmpty>
  {:else}
    <OverlayEmpty>
      <p class="text-sm">Search titles, tags and note text.</p>
      <p class="text-xs"><code>tag:math</code> and <code>"a phrase"</code> both work.</p>
    </OverlayEmpty>
  {/if}

  <footer
    slot="footer"
    class="shrink-0 truncate px-3 py-1.5 text-xs text-muted-light dark:text-muted-dark
           border-t border-t-muted-light dark:border-t-muted-dark"
  >
    ↑↓ move · ↵ open · Alt+↵ new column · Esc close
  </footer>
</OverlayShell>
