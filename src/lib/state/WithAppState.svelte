<script>
  import { afterNavigate, goto, replaceState } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { onMount, setContext, tick } from 'svelte';

  import * as keys from './keys.js';
  import { createNotesIndex } from './notes_index.js';
  import { createSelectionState, toNoteRef } from './selection.js';
  import { createLayoutState } from './layout.js';
  import { createTilesState } from './tiles.js';
  import { createHistoryState } from './history.js';
  import { createOverlayState } from './overlay.js';
  import { createPrefsState } from './prefs.js';
  import { createVizState } from './viz.js';
  import { createFilterState } from './filter.js';
  import { buildUrl, indexPath, notePath, readUrlState, slugFromPath } from './url_state.js';

  /**
   * The one provider. Everything shared lives in a store created here and read
   * with `useAppState(keys.X)`; nothing else calls `setContext`.
   *
   * Read `src/lib/CLAUDE.md` before touching the URL sync at the bottom — the
   * two directions have deliberately different rules and getting them wrong
   * produces either an infinite `replaceState` loop or a layout that silently
   * collapses to one column on every navigation.
   */

  /** `index.json`, for the slug → title index. @type {import('./notes_index.js').NoteSummary[]} */
  export let notes = [];

  /**
   * The visualization registry's descriptors, injected by
   * `(app)/+layout.svelte`. Passed in rather than imported so the state layer
   * does not depend on the visualization layer — and left empty by default
   * rather than seeded with a copy of the force graph's settings, which would
   * be a second definition free to drift from `viz/registry.js`.
   *
   * @type {{id: string, defaultSettings?: Record<string, unknown>}[]}
   */
  export let vizDescriptors = [];

  const initial = readUrlState($page.url);

  const notesIndex = createNotesIndex(notes);
  const selection = createSelectionState(toNoteRef($page.data?.note));
  const layout = createLayoutState({ mode: initial.mode });
  const tiles = createTilesState({ slugs: initial.tileSlugs, focusIndex: initial.focusIndex });
  const history = createHistoryState();
  const overlay = createOverlayState({ kind: initial.overlay, query: initial.query });
  const prefs = createPrefsState();
  const viz = createVizState(vizDescriptors);
  const filter = createFilterState();

  setContext(keys.NOTES_INDEX, notesIndex);
  setContext(keys.SELECTION, selection);
  setContext(keys.LAYOUT, layout);
  setContext(keys.TILES, tiles);
  setContext(keys.HISTORY, history);
  setContext(keys.OVERLAY, overlay);
  setContext(keys.PREFS, prefs);
  setContext(keys.VIZ, viz);
  setContext(keys.FILTER, filter);

  /**
   * URL → stores.
   *
   * Only on `popstate` (back/forward) and `enter` (first load) is the URL
   * authoritative for the *whole* layout. On our own navigations the store is
   * already correct and ahead of the URL — reconciling there would read the
   * not-yet-rewritten `?tile` params and collapse a three-column layout to one
   * on every click.
   *
   * For an ordinary `<a>` that was not routed through `tiles.open` (a backlink
   * in a note's metadata, say) we still have to honour the new path, so the
   * focused tile follows it without disturbing the rest.
   */
  afterNavigate((ev) => {
    if (ev.to === null) return;
    const url = ev.to.url;

    if (ev.type === 'popstate' || ev.type === 'enter') {
      const next = readUrlState(url);
      layout.setMode(next.mode);
      tiles.reconcile(next.tileSlugs, next.focusIndex);
      if (next.overlay) overlay.open(next.overlay);
      else overlay.close();
      overlay.setQuery(next.query);
      return;
    }

    const pathSlug = slugFromPath(url);
    if (pathSlug !== null) tiles.open(pathSlug);
  });

  /**
   * Half of the gate on the two URL-writing blocks below: the router has
   * started. `replaceState` throws before it has — which includes the whole
   * prerender — and a `goto` there would be equally wrong.
   *
   * **`onMount` on its own is not late enough, and the microtask is the fix.**
   * SvelteKit's `_hydrate` does `new app.root({...})`, which runs Svelte's
   * first flush and therefore every `onMount` in the tree, and only sets its
   * internal `started` flag a few synchronous statements later — after the
   * `afterNavigate('enter')` callbacks, which are inside the same window. So
   * both of the obvious places to raise this flag run while `replaceState`
   * still throws.
   *
   * And the throw is not survivable. Svelte's `flush()` catches, empties
   * `dirty_components` and rethrows, so every component still queued behind
   * this one never updates and their `onMount`s never run: the page keeps its
   * server-rendered markup and then patches erratically. That is what a blank
   * overlay panel in `viz` mode was — an aborted hydration, not an overlay bug.
   *
   * Deferring by one microtask lands after the whole synchronous tail of
   * `_hydrate`, `started` included. `buildUrl` being idempotent means there is
   * usually nothing to write when it does resolve; this is the guard for when
   * there is — a hand-written `?layout=split`, a legacy `?onlyContent`, a `?q=`
   * with no `?overlay=`, or an `?overlay=` on a `layout=viz` URL, where the
   * nudge below rewrites the mode during that very first flush.
   */
  let mounted = false;
  onMount(() => {
    tick().then(() => {
      mounted = true;
    });
  });

  /**
   * The second gate on both blocks, and the less obvious one.
   *
   * **SvelteKit updates the `page` store and flushes Svelte before it runs
   * `afterNavigate`** — `_navigate` does `root.$set(...)`, `update(page)`,
   * `await tick()`, and only then the callbacks. So there is a window in every
   * navigation where a reactive block sees the *new* URL next to the *old*
   * stores, because the reconcile below has not happened yet.
   *
   * On a back press that window is fatal to the path sync: focus still points
   * at the note you are leaving, the URL already names the one you are
   * returning to, they disagree, and an unguarded `goto` would push you
   * straight back where you came from. The back button would simply not work.
   *
   * `navigating` is non-null for exactly that window — SvelteKit clears it
   * *after* the `afterNavigate` callbacks — and clearing it re-runs both
   * blocks, by which time the stores are reconciled. So both are level checks
   * on settled state, never on a half-applied navigation.
   */
  $: settled = mounted && $navigating === null;

  // The focused tile is what "the active note" means. Derived in one place so
  // the visualization's highlight, the history strip and the URL cannot drift
  // apart.
  $: focusedSlug = $tiles.tiles[$tiles.focusIndex]?.slug ?? null;
  $: focusedRef = focusedSlug
    ? { slug: focusedSlug, title: notesIndex.titleOf(focusedSlug) }
    : null;
  $: selection.setActive(focusedRef);
  $: history.push(focusedRef);

  /**
   * An overlay lives inside the content pane, and in `viz` mode that pane is
   * hidden — `AppShell` gives it `display: none`. Opening one there widens the
   * layout back to split rather than being swallowed.
   *
   * It is here, not at the call sites, because there are five of them: the
   * toolbar buttons, the keyboard shortcuts, two commands, and `?overlay=` on a
   * URL that also says `layout=viz`. `layout.reveal()` leaves `content` mode
   * alone, which is what we want: the pane is already the whole body row, and
   * the visualization is worth keeping on screen while you search — the entire
   * reason the overlay covers the content area only.
   *
   * The `mode === 'viz'` test is redundant as a guard now that `reveal()` makes
   * its own check, and is kept for what it does to the *dependencies*: it keeps
   * this block **level**-triggered on the mode, so cycling to `viz` with an
   * overlay open snaps straight back to split. Drop it and the block becomes
   * edge-triggered on `overlay.kind` alone, which is a behaviour change.
   *
   * The other half of this — a *note* opening into a hidden pane — is **not**
   * here. It is `layout.reveal()` inside `openNote` (`navigate.js`), because
   * this shape cannot express it: a level check on the focused slug would make
   * `viz` mode unreachable whenever a note is open, and an edge on it would
   * also fire on `enter` and `popstate`, where `?layout=viz` is authoritative
   * and must be honoured exactly.
   */
  $: if ($overlay.kind && $layout.mode === 'viz') layout.reveal();

  /**
   * Focused tile → path.
   *
   * `buildUrl` never touches the pathname, so this is the *only* thing that
   * changes it, and it is a `goto` — a different note being on screen is
   * exactly what the back button should undo, unlike the layout fiddling below.
   *
   * It is one block rather than a `goto` at each call site because there is no
   * single call site: opening a note moves focus, so does closing a column,
   * splitting one, and clicking into another. Deriving the path from focus
   * covers all four, and `openNote` is a tile mutation only for that reason
   * (see `navigate.js` — do not put a `goto` back in it, you get two).
   *
   * The comparison is against the *slug*, not the href: `/notes/<slug>` and
   * `/<slug>` are the same note, and rewriting one into the other would kick
   * every note-only URL out of note-only mode on arrival.
   */
  $: if (settled && focusedSlug !== slugFromPath($page.url)) {
    // The content pane restores its own per-tile scroll; letting the router
    // scroll as well would fight it.
    goto(focusedSlug ? notePath(focusedSlug) : indexPath(), { noScroll: true });
  }

  /**
   * Stores → URL.
   *
   * `replaceState`, never `goto`: the path is changed by whoever opens a note,
   * and only that should land in the browser history. Layout fiddling must not
   * fill the back stack.
   *
   * The `href` compare is load-bearing. `URL` objects compare by reference, so
   * an unguarded check fires `replaceState` on every reactive run (ISSUES.md
   * B8). The `settled` guard is equally load-bearing: `replaceState` throws if
   * the router has not initialised yet, which includes the whole prerender,
   * and mid-navigation it would stamp the outgoing layout onto the incoming
   * URL.
   */
  $: if (settled) {
    const target = buildUrl($page.url, {
      mode: $layout.mode,
      tileSlugs: $tiles.tiles.map((t) => t.slug),
      focusIndex: $tiles.focusIndex,
      overlay: $overlay.kind,
      query: $overlay.query
    });
    if (target.href !== $page.url.href) replaceState(target, {});
  }
</script>

<slot />
