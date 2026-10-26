<script>
  import { onDestroy, onMount } from 'svelte';

  import OverlayEmpty from './OverlayEmpty.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import QueryDisplay from '$lib/search/QueryDisplay.svelte';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import SearchMatch from '$lib/search/SearchMatch.svelte';
  import { parseSearchString } from '$lib/search/query.js';
  import { getSearchClient, PAGE } from '$lib/search/search_client.js';
  import {
    useAppState,
    LAYOUT,
    NOTES_INDEX,
    OVERLAY,
    PREFS,
    SELECTION,
    TILES
  } from '$lib/state/keys.js';
  import { toNoteRef } from '$lib/state/selection.js';
  import { openNote } from '$lib/state/navigate.js';

  /**
   * Find a note and open it. What the `/search` route used to be, minus the
   * route: it opens over whatever you are reading instead of replacing it.
   *
   * Keyboard-first — ↑/↓ move the cursor, Enter opens in the focused column,
   * Alt+Enter in a new one, Escape closes (handled by `AppShell`).
   *
   * Renders `PAGE` rows at a time; the cursor stays among the rendered ones.
   * A broad term can match the whole collection, and rows are DOM.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );
  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );

  /** Seeded from `?q=`, so a shared search URL opens with its results. */
  let value = $overlay.query;

  /** @type {import('$lib/search/search_client.js').SearchClient | null} */
  let client = null;
  /** @type {import('$lib/search/query.js').ParsedQuery | null} */
  let query = null;
  /** `null` means "nothing has been searched yet", which is not "no match". */
  let results = /** @type {import('$lib/search/search_client.js').Match[] | null} */ (null);
  /** @type {import('$lib/search/search_client.js').Snippets} */
  let snippets = {};
  let shown = PAGE;
  let searching = false;
  /** The first search waits for the worker to build the index; say so. */
  let indexing = false;
  let failed = false;
  let highlight = 0;

  /**
   * Monotonic run counter. Every search is a round trip to the worker, so two
   * keystrokes can be in flight at once and nothing orders their replies.
   * Only the newest run may write `results`.
   */
  let latest = 0;

  /** @param {string} searchString */
  async function run(searchString) {
    // Keeps `?q=` in step. Already debounced: `SearchBar` only dispatches once
    // the typing stops, so this is not a `replaceState` per keystroke.
    overlay.setQuery(searchString);

    const mine = ++latest;

    const parsed = parseSearchString(searchString);
    if (!parsed) {
      query = null;
      results = null;
      searching = false;
      return;
    }

    searching = true;
    if (!client) client = getSearchClient(notesIndex);
    indexing = !client.ready;

    try {
      const found = await client.search(parsed);
      if (mine !== latest) return;
      results = found.matches;
      snippets = found.snippets;
      failed = false;
    } catch (err) {
      if (mine !== latest) return;
      console.error(err);
      results = [];
      snippets = {};
      failed = true;
    }

    query = parsed;
    shown = PAGE;
    highlight = 0;
    searching = false;
    indexing = false;
  }

  async function showMore() {
    if (!client || !results) return;
    const mine = latest;
    const next = results.slice(shown, shown + PAGE);
    shown += PAGE;
    const more = await client.snippets(next).catch(() => ({}));
    if (mine === latest) snippets = { ...snippets, ...more };
  }

  /**
   * @param {import('$lib/search/search_client.js').Match} match
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
    const count = Math.min(results?.length ?? 0, shown);

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

  /**
   * The cursor's note is lit in the visualization, the way hovering a link in
   * a note lights its node — so walking the results shows where each one sits
   * in the graph. Written only when the cursor or the results move; the
   * canvas's own pointer hover is free to overwrite it in between.
   */
  $: selection.hover(toNoteRef(results?.[highlight]?.note));

  onMount(() => {
    // Opening the overlay is what starts the worker — and with it the
    // download of every note's plaintext — so the index builds while the
    // first query is still being typed. See `search_client.js`.
    client = getSearchClient(notesIndex);
    if (value) run(value);
  });

  onDestroy(() => selection.hover(null));
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

  <!--
    The previous results stay up while the next query runs: a query takes
    milliseconds, and swapping the list for "searching …" on every keystroke
    only made it flicker.
  -->
  {#if failed}
    <OverlayEmpty><p class="text-sm">search failed — see the browser console</p></OverlayEmpty>
  {:else if results && results.length > 0}
    {#each results.slice(0, shown) as match, i (match.note.slug)}
      <SearchMatch
        {match}
        snippet={snippets[match.note.slug]}
        active={i === highlight}
        showMeta={$prefs.showMeta}
        on:open={(ev) => open(match, ev.detail.where)}
        on:mouseenter={() => (highlight = i)}
      />
    {/each}
    {#if results.length > shown}
      <button
        class="w-full px-4 py-3 text-left text-sm text-muted-light dark:text-muted-dark
               hover:text-front-light dark:hover:text-front-dark"
        on:click={showMore}
      >
        show {Math.min(PAGE, results.length - shown)} more of {results.length - shown}
      </button>
    {/if}
  {:else if results}
    <OverlayEmpty><p class="text-sm">no match</p></OverlayEmpty>
  {:else if searching}
    <OverlayEmpty>
      <p class="text-sm">{indexing ? 'indexing notes …' : 'searching …'}</p>
    </OverlayEmpty>
  {:else}
    <OverlayEmpty>
      <p class="text-sm">Search titles, tags and note text.</p>
      <p class="text-xs">
        <code>tag:math</code>, <code>"a phrase"</code>, <code>-word</code> and
        <code>path:cs</code> all work.
      </p>
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
