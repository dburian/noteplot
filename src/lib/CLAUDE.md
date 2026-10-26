# `src/lib` — components and state

> **Keep this file current.** The store table below is the load-bearing part of this file. If
> you add, rename, or remove a context key, update it in the same commit.

## The state layer (`src/lib/state/`)

> **Status.** This is now the live state layer. `WithAppState` is mounted by
> `(app)/+layout.svelte`, and the five provider components it replaced — `WithGraphState`,
> `WithContentState`, `WithContentSliderState`, `WithFilterContext` and `Adaptive`'s switch — are
> deleted. `adaptive` is the one legacy context key left, and nothing mounts its provider.
>
> The toolbar reads `LAYOUT`, `VIZ`, `HISTORY`, `TILES`, `OVERLAY` and `FILTER`; the force
> graph reads `SELECTION`, `VIZ` and `FILTER`; the content pane reads `TILES`, `NOTES_INDEX` and
> `PREFS`; the overlays read `OVERLAY`, `FILTER`, `TILES` and `PREFS`, and the command palette
> reads every store there is. **Every store now has both a reader and a writer** — the gap the
> previous revision of this file warned about (a `FILTER` nothing wrote, an `OVERLAY.kind` nothing
> rendered) closed when the overlays landed.

Everything shared lives in a store created by **one** provider, `state/WithAppState.svelte`. It is
the only place in the app that calls `setContext`. Consumers read a store with:

```js
import { useAppState, LAYOUT } from '$lib/state/keys.js';
const layout = useAppState(LAYOUT);
```

`useAppState` **throws** on a missing provider instead of returning `undefined`. That is the whole
reason it exists: `getContext('typo')` returns `undefined`, `{#if $store.foo}` on `undefined`
renders nothing, and the result is a control that silently never appears. That is not
hypothetical: the old toolbar guarded its resize handle on `$contentSlider.hasContent`, a field
that lived on a different context, so the handle never mounted at all (ISSUES.md B5). Keys are
constants in `state/keys.js`, so a typo is a build error.

The stores are plain `.js` factories, not components — readable and testable on their own. Each
returns `{ subscribe, ...named actions }` and no bare `set`, following the existing convention.

### The stores

| Key (`state/keys.js`) | Module           | Value                                    | Notes                                                                     |
| --------------------- | ---------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `NOTES_INDEX`         | `notes_index.js` | `{bySlug, all, titleOf}`                 | not a store — a static lookup built from `index.json`                     |
| `SELECTION`           | `selection.js`   | `{activeNote, hoveredNote}`              | `{slug,title}` refs only (ISSUES.md B9)                                   |
| `LAYOUT`              | `layout.js`      | `{mode, vizFraction, lastSplitFraction}` | `mode` is `'split'｜'viz'｜'content'`                                     |
| `TILES`               | `tiles.js`       | `{tiles: [{id, slug}], focusIndex}`      | zero tiles is legal and means "no note open"                              |
| `HISTORY`             | `history.js`     | `{recent: [{slug,title}]}`               | max 8, deduped, `sessionStorage`                                          |
| `OVERLAY`             | `overlay.js`     | `{kind, query}`                          | `kind` is `null｜'search'｜'filter'｜'commands'｜'settings'｜'shortcuts'` |
| `PREFS`               | `prefs.js`       | `{showMeta}`                             | `localStorage`                                                            |
| `VIZ`                 | `viz.js`         | `{activeId, settings: {[vizId]: {...}}}` | `localStorage`; per-visualization settings slices                         |
| `FILTER`              | `filter.js`      | `{query, results}`                       | moved verbatim from `search/WithFilterContext.svelte`                     |
| `SHORTCUTS`           | `shortcuts.js`   | `{bindings, byChord, overrides}`         | `localStorage`; stores only overrides of `defaultKeys`                    |

Three invariants in there are load-bearing and easy to "simplify" away:

- **`selection.hover()` returns the state object untouched** when the slug has not changed, so no
  subscriber fires. It runs on every pointermove over a node; a fresh object each time meant a
  full graph redraw each time (ISSUES.md C1).
- **`filter.setQueryAndResults` is one call, not two.** `CanvasGraph.onFilterChange` early-returns
  on an unchanged `results` reference, which only helps if there is a single write (ISSUES.md C11).
- **Tile ids are a monotonic counter, never random.** They key the `{#each}` _and_ the scroll
  memory, so `Math.random()` / `Date.now()` here would break scroll restoration.

`layout` deliberately replaces both `contentState` and `contentSliderState`. There is nothing left
to keep in sync — `mode` and `vizFraction` are fields of one object, so the oscillation the old
bidirectional block could produce is structurally impossible. `lastSplitFraction` plays the role
`lastSetWidth` used to: collapsing and re-expanding restores the width the user chose.

`layout.reveal()` is the one action that is _not_ a user asking for a mode. It means "something is
about to appear in the content pane", and it widens `viz` back to `split` and does nothing in the
other two modes — deliberately **not** `setMode('split')`, which would drag `content` mode into
split and undo a choice the user made. Its callers are `openNote`, the overlay nudge in
`WithAppState`, and the three `tiles.splitRight()` sites.

`persist.js` wraps both storages with the two guards every caller needs: `typeof window` (these
modules are imported during prerender, and there is no `Adaptive` gate any more to stop them
running on the server) and try/catch (storage throws in private-mode Safari).

### The URL contract, and the two directions

`state/url_state.js` is the only place the URL is read or written. The URL carries the whole
layout:

```
/<focused-slug>?tile=<slug>&tile=<slug>&focus=<n>&layout=<mode>&overlay=<kind>&q=<query>
```

- The **path** is the focused tile's slug — redundant with `tile`/`focus` and deliberately so: it
  keeps the `[slug]` route, its `load`, and prerendering working untouched.
- **`tile` is repeated**, once per column, not comma-joined. `toSlug` escapes only `~` and `-`, so
  a slug can contain a comma and a joined list would be ambiguous. Omitted for a single tile.
- `layout` is omitted for the `split` default, and also under `/notes/`, whose pathname already
  means content-only. The old `?onlyContent` / `?noContent` are gone, and `buildUrl` strips them.

**The two directions have different rules. Do not unify them.**

| Direction     | Mechanism                          | When                                       |
| ------------- | ---------------------------------- | ------------------------------------------ |
| stores → path | `goto`, slug-compared              | the focused tile's slug changes            |
| stores → URL  | `replaceState`, `href`-guarded     | any layout/overlay/tile change             |
| URL → stores  | `afterNavigate`, full reconcile    | only `ev.type === 'popstate'` or `'enter'` |
| URL → stores  | `afterNavigate`, focused tile only | every other navigation type                |

Both stores → \* blocks are gated on `settled` (`mounted && $navigating === null`), and both halves
of that gate are load-bearing:

- **`mounted`** — `replaceState` throws before the router has initialised, which includes the
  whole prerender. **It is raised one microtask after `onMount`, and that delay is load-bearing.**
  SvelteKit's `_hydrate` does `new app.root({...})` — which runs Svelte's first flush and therefore
  every `onMount` in the tree — and sets its internal `started` flag only a few synchronous
  statements later, after the `afterNavigate('enter')` callbacks. So `onMount` and `afterNavigate`
  are both inside the window where `replaceState` still throws, and the throw is not survivable:
  Svelte's `flush()` empties `dirty_components` and rethrows, so every component queued behind
  `WithAppState` never updates and their `onMount`s never run. The page keeps its server-rendered
  markup and then patches erratically — which presented as an empty overlay panel, an aborted
  hydration wearing an overlay bug's clothes. A microtask lands after the whole synchronous tail of
  `_hydrate`.
- **`$navigating === null`** — **SvelteKit updates the `page` store and flushes Svelte _before_ it
  runs `afterNavigate`.** (`_navigate` does `root.$set(...)`, `update(page)`, `await tick()`, then
  the callbacks.) There is therefore a window in every navigation where a reactive block sees the
  new URL beside the not-yet-reconciled stores. For the path sync that window is fatal: on a back
  press, focus still names the note you are leaving while the URL already names the one you are
  returning to, and an unguarded `goto` sends you straight back — the back button simply stops
  working. `navigating` is non-null for exactly that window and is cleared _after_ the callbacks,
  so clearing it re-runs both blocks against settled state.

- `buildUrl` **never touches the pathname**. A path change is a `goto` (it should be a back-button
  stop); a query change is a `replaceState` (fiddling with the layout must not fill the back
  stack). Use `notePath(slug)` for the former.
- The `href` compare before `replaceState` is not an optimisation. `URL` objects compare by
  reference, so an unguarded check fires on every reactive run (ISSUES.md B8).
- **`buildUrl` must stay idempotent**, or that compare is worse than useless: it reports a change
  on a URL nothing changed, forever. `URLSearchParams` is order-sensitive in a way that makes the
  obvious implementation silently non-idempotent — `delete` + `append` moves a key to the end while
  `set` keeps an existing key in place — so `?tile=a&tile=b&focus=1`, a URL `buildUrl` had itself
  written, came back out as `?focus=1&tile=a&tile=b`. Every load of a two-column URL then wrote the
  URL during hydration, and the `mounted` gate above did not hold. It now deletes every param it
  owns up front and writes them in one fixed order; params it does not own keep their place. Verify
  a change to it by asserting `buildUrl(buildUrl(u, s), s).href === buildUrl(u, s).href`.
- **The reconcile is restricted to `popstate`/`enter` on purpose.** On our own navigations the
  store is already correct and _ahead_ of the URL; reconciling there would read the
  not-yet-rewritten `?tile` params and collapse a three-column layout to one column on every
  click. For other navigation types only the focused tile follows the new path, which is what an
  un-intercepted `<a>` (a metadata backlink) needs.
- `tiles.reconcile` keeps the existing `id` of any tile whose slug already matches at that
  position. Minting fresh ids per navigation would invalidate the scroll memory on exactly the
  back/forward presses it exists to serve.

### The path follows focus, and nothing else moves it

`buildUrl` never touches the pathname, so **one reactive block in `WithAppState` owns every path
change**: when the focused tile's slug and the path's slug disagree, it `goto`s the focused one
(or `indexPath()` at zero tiles). `goto` and not `replaceState` because a different note being on
screen is exactly what the back button should undo; `noScroll` because the content pane restores
its own per-tile scroll.

It is one block rather than a `goto` at each call site because **there is no single call site**.
Opening a note moves focus — but so does closing a column, splitting one, and clicking into
another, and none of those go through `openNote`. Deriving the path from focus covers all four,
and it is why the toolbar's Close button updates the URL without knowing anything about routing.

The comparison is on the _slug_, not the href: `/notes/<slug>` and `/<slug>` are the same note, and
rewriting one into the other would kick every note-only URL out of note-only mode on arrival.

### `state/navigate.js` — open a note

`openNote(tiles, layout, slug, opts)` is `tiles.open` plus the `where` default and
`layout.reveal()`, and **every navigation source must go through it** — the canvas, the history
chips, and both search-shaped overlays.

It is the tile half plus the layout nudge. **Do not put a `goto` back into it**: the block above
already navigates on the focus change that `tiles.open` produces, so a second one here is a
duplicate history entry for one click. The tile half is still a genuine no-op when the note is
already in the focused tile — the store does not change, so nothing navigates — but `reveal()`
runs regardless, which is the point: clicking the node of the note in the _hidden_ focused tile
has to show it to you.

**`layout` is a required positional parameter, not a field on `opts`.** That is the whole reason
it reads awkwardly: with `checkJs` on, a call site left un-updated passes a `string` where a
`LayoutStore` is expected and `npm run check` names it. An optional field would be silently
omitted, which is exactly the drift this shared helper exists to prevent.

`layout.reveal()` widens `viz` mode back to `split` (restoring `lastSplitFraction`) and leaves
`split` and `content` untouched. It is **one-way** — closing the note or the overlay does not snap
back, on the same principle as Escape leaving the filter applied. The two overlays' calls are a
no-op in practice, since the nudge below already widened the layout to open the overlay at all,
but they go through the same helper because they are a navigation source like any other.

`WithAppState`'s `afterNavigate` calls `tiles.open(pathSlug)` on any non-`popstate` navigation, to
catch links it did not route (a metadata backlink, say). That call is a no-op when `openNote` ran
first, and does the work when it did not. It deliberately stays on `tiles.open` rather than
`openNote`: a first load or a bookmark arrives as `enter`, where `?layout=viz` is authoritative and
revealing the pane would override the URL. Same for the `popstate`/`enter` reconcile above — which
is also why `tiles.js` knows nothing about layout, or `reconcile` would reveal on every back press.

`notePath()` carries no query string, so the URL momentarily loses `?tile`/`?layout`. The stores →
URL block writes them straight back from state the navigation never touched.

## Component tree

```
(app)/+layout.svelte              passes viz/registry.js's descriptors into the state layer
└─ WithAppState                   the only setContext in the app; URL ⇄ stores
   └─ AppShell                    h-screen flex-col; owns nothing but the layout
      ├─ Toolbar                  shrink-0 strip across the top
      │  ├─ VizSection            natural width
      │  │  ├─ VizSwitcher        active viz's label (= layout cycle) + registry dropdown
      │  │  └─ activeViz.Controls → ForceGraphControls: Connections, Tag glow
      │  ├─ HistorySection        flex-1 min-w-0; scrolls horizontally
      │  └─ ContentSection        natural width
      └─ (body row)               flex-1 min-h-0 flex-row
         ├─ VizPane               always mounted; display:none in mode === 'content'
         │  └─ activeViz.View     → ForceGraphView: a <canvas> + CanvasGraph
         ├─ PaneDivider           mounted only in mode === 'split'
         └─ ContentPane           always mounted; display:none in mode === 'viz'
                                  owns document.title; relative
            ├─ Tile × N              flex-1 columns, TileDivider between them
            │  ├─ TileHeader         note title + close, shrink-0
            │  └─ (scroll container) flex-1 min-h-0 overflow-y-auto
            │     └─ NoteContent     from getNote(tile.slug) — no column is special
            └─ OverlayHost           only when $overlay.kind; owns focus restore
               └─ Search | Filter | Command | Settings | ShortcutsOverlay
                  └─ OverlayShell    absolute inset-0, opaque, fills the pane
                                     header / input / body / footer slots
```

Everything here is a real flex child. Nothing is `fixed`, and no component has to be told how much
of it is covered by another — which is what the old arrangement (a full-screen canvas with a
`fixed right-0` pane painted over it, and the pane's measured width plumbed back into the
renderer's `insetRight`) existed to work around.

The body row carries one attribute for the force graph's benefit: **`data-viz-frame`**.
`CanvasScreen` finds it with `closest()` and letterboxes the graph into the row rather than into its
own canvas, so the graph's coordinates do not change when the panes are resized or the mode
switches. That is a measurement the renderer takes for itself, not a revival of `insetRight`:
nothing pushes a pane width into it, and what the content pane covers is culled rather than
squeezed. See `viz/CLAUDE.md`'s coordinate-space section.

`min-h-0` on the body row and `min-w-0` on each pane are **not optional**. A flex item refuses to
shrink below its content's intrinsic size without them, and the scroll container inside
`ContentPane` then never scrolls.

That is the whole tree; the redesign adds no more nodes.

**Neither pane is ever unmounted.** `AppShell` hides the one the mode excludes with
`display:none` and keeps it in the tree, because `{#if}` here throws away exactly what the user
wants back: `VizPane` remounts `<svelte:component>`, which rebuilds `CanvasGraph` from scratch, so
cycling the layout through content-only would reset the transform to identity and lose the zoom and
pan; and `ContentPane` drops every column's rendered note.

Two consequences, both already handled:

- A hidden canvas measures `0 x 0`. That is safe — the graph is letterboxed into the body row, not
  into the canvas, so the mapping survives the round trip — and the `ResizeObserver` fires again
  with the real size when the pane comes back, so there is no extra plumbing.
- `display:none` destroys the scroll boxes inside the content pane, and a recreated box is at the
  top. `AppShell` therefore passes `ContentPane` a `hidden` prop as well as the style, and
  `ContentPane` snapshots its tiles' offsets on the way out and restores them on the way back
  (`scroll_memory.js`'s `hold()`). The order works because Svelte runs reactive statements
  _before_ it patches the DOM, so the snapshot happens while the boxes still exist.

`OverlayHost` lives inside `ContentPane`, so an overlay opened in `viz` mode would be inside a
`display:none` subtree — and a note opened there lands in a column nobody can see. Both are
resolved in the state layer rather than here, and by the same `layout.reveal()`: `WithAppState`
calls it when `overlay.kind` becomes non-null, and `openNote` calls it for every note. The three
`tiles.splitRight()` call sites — `AppShell`'s Ctrl/Cmd+`\`, `ContentSection`'s Split button, the
`content.split` command — call it too, for the same reason: all three are reachable while the pane
is hidden. See `overlay/` below for why the modal is anchored to the content pane in the first
place.

### Keyboard shortcuts

All of them go through **one window-level handler in `AppShell`**, not spread across the components
they drive: a shortcut has to work when nothing in particular is focused, and a handler inside an
overlay could only ever run once that overlay was already open.

**A shortcut is a chord bound to a command id**, and the handler is a lookup: `chordFromEvent(ev)`
→ `$shortcuts.byChord` → `commandsById` → `command.run(ctx)`. Nothing in `AppShell` knows which
key does what. The actions are the command registry; the defaults are each command's
`defaultKeys`; the user's changes are `state/shortcuts.js`, edited from the settings overlay.

| Default keys        | Command                                        |
| ------------------- | ---------------------------------------------- |
| `Ctrl/Cmd+K` or `/` | `overlay.search` — toggle the search overlay   |
| `Ctrl/Cmd+Shift+F`  | `overlay.filter` — toggle the filter overlay   |
| `Ctrl/Cmd+Shift+P`  | `overlay.commands` — toggle the palette        |
| `Escape`            | `overlay.close` — close the overlay            |
| `Ctrl/Cmd+\`        | `content.split` — split the focused note right |
| `Ctrl/Cmd+B`        | `layout.cycle` — cycle the layout              |

Every other command is unbound by default and can be bound.

**Chords** (`commands/chord.js`) are `Mod+Alt+Shift+<key>` in that fixed order, key lower-cased.
`Mod` is Ctrl _or_ Cmd. Shift is dropped for a non-letter character, because on many layouts a
symbol needs Shift to type at all (`/` is Shift+ú on Czech) — without that, `/` would be a different
chord per layout. Write defaults in this form (`'Mod+k'`, not `'Mod+K'`); `formatChord` is for
display only and is never parsed back.

The handler bails out when the event target is an `input`, `textarea` or `[contenteditable]` —
**unless the command has `allowInInput`**, which only `overlay.close` has: Escape is how you leave
the overlay you are typing in. A command whose `enabled(ctx)` is false leaves the key alone, so
Escape with nothing open is not swallowed. Escape is handled here and nowhere else;
`OverlayShell` deliberately carries no key handler, so there is one closer rather than two racing
to call the same action. The shell's ✕ button is a second _closer_ — it calls the same
`overlay.close()` — but not a second Escape handler, and `overlay/focus_trap.js` sees only `Tab`
for the same reason.

`ctx` comes from `commands/context.js`'s `useCommandContext()`, which reads `values` with `get()`
at keypress time. The palette builds its own reactive `ctx` instead, because it needs `enabled` to
re-evaluate as state changes.

## Directories

### `content/`

The right-hand area: `ContentPane.svelte`, `Tile.svelte`, `TileHeader.svelte`,
`TileDivider.svelte` and `scroll_memory.js`.

`ContentPane` is a flex row of `Tile`s, one per entry in `$tiles.tiles`, sharing the space equally.
Zero tiles is a legal state, not an error — it is the bare-visualization `/` route — and the shell
hides the whole pane for it (see `shell/` below), so `ContentPane` has no empty state. `TileDivider` is purely visual; per-column resizing is out of scope, but it is
deliberately the same `shrink-0 w-1` box as `shell/PaneDivider.svelte` so making it draggable later
is adding handlers rather than redoing the layout.

Four things in here are load-bearing:

- **The `{#key tile.slug}` sits _inside_ the scroll container.** `WithHoverableLinks` re-wires its
  listeners in `onMount`, so something has to key on the slug — but the component this replaces
  (`note/Note.svelte`) wrapped its `overflow-auto h-screen` div in the `{#key}`, which destroyed
  and recreated the scroller on every navigation. A box that did not exist a moment ago has no
  scroll position to restore, which is why scroll restoration could never work before.
- **Every tile renders its note the same way, and none of them is special.** It is one
  `{#await getNote(tile.slug)}`, and `getNote` returns the note _itself_ once it is loaded, so the
  then-branch renders synchronously — which is what puts the real note into the prerendered HTML and
  what keeps a freshly split column from flashing. **The expression must return a stable reference
  per slug**; see `notes_route.js` below for why, and do not inline an `async` call there again.
  There used to be a second path: the focused tile whose slug matched `$page.data.note.slug`
  rendered the route's `+page.svelte` through a chain of `<slot/>`s. That tile is gone along with
  the chain, because _which_ tile it was moved on every split — so the column handing the slot over
  was destroyed and rebuilt for a note that had not changed, which flickered and took its scroll
  position with it.
- **`ContentPane` owns `document.title`**, derived from the focused tile via `NOTES_INDEX`. It is
  not on `NoteContent`, where N mounted copies would fight over it, and not on the route's page
  either — the pages render nothing now, so there is no page to put it on. `src/app.html`
  deliberately has **no** `<title>` — a hard-coded one sits before `%sveltekit.head%` and wins,
  which is why every prerendered note page used to ship the title "Noteplot".
- **`min-h-0` on the scroll container and `min-w-0` on the tile.** Same rule as the shell: a flex
  item will not shrink below its content's intrinsic size without them, and nothing scrolls.

`scroll_memory.js` is manual scroll restoration, and it exists because the window never scrolls —
SvelteKit's own restoration only ever moves the window, so it is inert here. It keeps
`Map<historyKey, Map<tileId, scrollTop>>`, snapshots every mounted tile in `beforeNavigate` (while
`history.state` still describes the entry being left), and in `afterNavigate` either restores that
entry's positions on `popstate` or scrolls the focused tile to `0` otherwise. Details that matter:

- the key is `history.state['sveltekit:index']`, not the href — it is the only thing that
  distinguishes two visits to the _same_ URL, and telling those apart is most of the point;
- the restore is behind `await tick()`, because assigning `scrollTop` before the new content has
  laid out clamps against a height that is still zero;
- it is keyed by **tile id**, which is why `tiles.js` mints ids from a counter and
  `tiles.reconcile` preserves them — fresh ids per navigation would invalidate the memory on
  exactly the back presses it exists to serve;
- the map is capped at 50 entries, evicted least-recently-used (`snapshot` re-inserts the key
  rather than overwriting it in place, so `Map`'s insertion order _is_ the LRU order);
- `hold()` is the same trick with no history key attached, for hiding the pane rather than
  navigating away from it: it snapshots the mounted tiles now and hands back the function that puts
  them back. `ContentPane` calls it when `AppShell` hides it — see the shell section above. While a
  hold is outstanding it is also the module's record of where the tiles are, because a hidden box
  has no layout: `scrollTop` reads `0` and writing it does nothing. So `snapshot` stores the held
  offsets rather than the DOM's, and `afterNavigate` amends the hold instead of touching the boxes
  — otherwise clicking a graph node in `viz` mode would come back to the old note's offset applied
  to the new note.

Verify it by hand — there are no tests: open note A, scroll halfway, click a link to B, press Back.
You must land at the same offset in A.

### `shell/`

`AppShell.svelte` and `PaneDivider.svelte`.

**A lone visible pane is given `flex-grow: 1`, not its fraction.** When the flex-grow factors on a
line sum to _less than 1_, the items share only that much of the free space (CSS Flexbox §9.7) and
the rest is left empty — so with `flex-basis: 0%`, a single pane at `flex: 0.618` covered 61.8% of
the row and left a blank strip of body-row background next to the graph, which reads as a stray div
painted over it. `content` mode had the mirror at 38.2%. `split` was always right and hid it: `f`
and `1 - f` sum to exactly 1. `vizFraction` still stores what the user dragged to; it is only the
_grow factor_ that is overridden, and only in the two single-pane modes.

**The shell lays out `visibleMode(...)`, not `$layout.mode`.** With no tiles and no overlay open the
content pane has nothing to show, so `layout.js`'s `visibleMode` reports `viz` and the graph takes
the whole row. The stored mode is untouched — it is the user's choice and lives in `?layout=` — so
opening a note brings their split or content layout back by itself, with no snap-back logic. The
overlay term is load-bearing: `OverlayHost` is mounted inside the content pane, so search opened
from `/` must bring the pane up. `toolbar/VizSection` uses the same helper to decide whether the
visualization's controls are on screen. Cycling the layout at zero tiles therefore changes the
switcher's glyph but not the view.

The divider uses **pointer capture** — `setPointerCapture` on `pointerdown`, release on
`pointerup` — rather than attaching listeners to `document.body`. The component it replaces
(`toolbar/buttons/ResizeContent.svelte`) attached `mousemove`, `mouseup` and `mouseleave` to the
body and removed only the first on release, leaking a pair per drag and firing `confirmWidth()` on
every later body mouseup. Capture makes that class of bug structurally impossible.

It measures against the body row's `getBoundingClientRect()`, passed down from `AppShell` as
`bodyEl`, not `document.body.clientWidth` — the row is inset by the toolbar and can be inset
horizontally by scrollbars.

`confirmFraction()` may snap the mode and unmount the divider mid-handler. That is safe only
because capture is released first; keep that order.

### `notes_route.js`

The only module at the top of `$lib` that is not a component. It holds the one
`import.meta.glob('$lib/notes/*.json')` over the preprocessor's output and exports `getNote(slug)`,
`loadNote(slug)` and `noteEntries()` — see `src/routes/CLAUDE.md`. Keep the glob here rather than in
a route: having it in one place is what stops the two routes drifting apart again, and it is where
the `__`-prefix convention for generated files is enforced.

**`getNote` is the frontend's entry point and `loadNote` is the routes'.** They share one
`Map<slug, Note | Promise<Note>>`, which makes the second half of that split load-bearing: a
route's `load` calls `loadNote`, so by the time `ContentPane` renders, the path's note is a _value_
in the cache and the prerendered HTML contains the real note rather than a "Loading …" placeholder.
Verify that against `build/<slug>.html`, not by reasoning about it.

Three rules in `getNote`:

- **The return value is stable per slug.** Svelte compiles `{#await expr}` with an identity guard
  (`r !== (r = expr) && handle_promise(...)`), and `Tile` re-evaluates that expression on every
  `$tiles` write — `tile` is an object prop, and `safe_not_equal` calls every object assignment a
  change. So the old `{#await loadNote(tile.slug)}`, minting a fresh promise per call, tore the
  resolved note down and remounted "Loading …" in **every** open column on every split, close and
  focus change, and the collapsed content clamped each column's `scrollTop` to zero on the way.
- **A miss returns a rejected promise, never a synchronous throw** — it is called from a template
  expression, where a throw takes the render down with it. `loadNote` keeps the `error(404, …)`,
  because only a `load` can turn that into a response.
- **A rejection is evicted from the cache**, so the next render retries rather than being stuck in
  `{:catch}` forever after one failed chunk fetch.

It also exports `loadSearchNotes()`, a memoised lazy loader for `search.json`. It returns the
**same promise** every call, because `getSearchIndex` memoises the built index on the resolved
array's identity.

### `note/`

Renders a loaded note JSON. `NoteContent.svelte` takes the whole note as **one `note` prop** —
not a `{...note}` spread of its fields — and `{@html note.html}`s the preprocessor's output
inside `Prose`. The spread meant declaring a prop per key of the generated JSON, including `title`
and `path`, which nothing in there renders; an undeclared key in a spread warns at runtime and a
declared-unused one warns at compile time, and the object sidesteps both. The shape is the `Note`
typedef in `$lib/notes_route.js`, which is the frontend's description of what `emitters/notes.js`
writes. `NoteMetaContent.svelte` is the
metadata block (references, backlinks, tags, reading time), gated on `$prefs.showMeta` — the
settings overlay's metadata toggle. `WithHoverableLinks.svelte` reaches into the rendered HTML, finds
`a[data-slug]` and wires hover events to the `SELECTION` store, so hovering a link in prose
highlights the node in the visualization and vice versa — the `data-slug` attribute is injected
back in `preprocessor/parse/plugins.js`'s `addLinks`.

**Everything in here is now mounted once per open column, and two habits had to go because of it:**

- `WithHoverableLinks` **binds and queries its own container**. It used to do
  `document.querySelectorAll('#note-content a[data-slug]')` — a document-wide search for a
  hard-coded id, correct only while exactly one note was ever mounted. With N columns that id is
  duplicated and every instance would wire up, and later un-wire, every other column's links. The
  scoped `.hovered-link` styles hang off a class for the same reason.
- `NoteContent` sets **no** `<svelte:head><title>`; `content/ContentPane.svelte` owns the title.

`WithHoverableLinks` still depends on `onMount` re-running per note. That is what the
`{#key tile.slug}` inside each tile's scroll container is for — see `content/` above, and note
that moving that `{#key}` outward breaks scroll restoration.

`NoteContent` used to guard its `WithHoverableLinks` wrapper with `hasContext('graphState')`,
because the mobile branch had no provider. There is one provider for the whole app now — and no
`graphState` — so the guard is gone.

### `search/`

`search_index.js` exports `MiniSearchIndex`, the only index actually used. It wraps `minisearch`
over the `content`, `title`, and `tag` fields, and `parseSearchString` implements a small query
language: bare terms, quoted phrases, and `field:term` prefixes, all combined with `AND`. The
field list is the module constant `FIELDS`, read by both the constructor and the parser — one
list, so `field:` cannot name something that was never indexed. (It used to be read back out of
`minisearch`'s `protected _options`.)

**Do not construct it directly — call `getSearchIndex(notes)`.** It memoises one instance on the
`notes` array's identity, so search and filter share the built index instead of re-indexing the
corpus on every mount (ISSUES.md B3). Feed it `loadSearchNotes()`'s resolved array untouched; copy
or spread it and the memo does not hold.

**And do not import this module from anything the overlays import eagerly** — `lazy_index.js`
exists to keep that from happening. It `import()`s `search_index.js` and `loadSearchNotes()`
together and memoises the resulting promise, so `minisearch` and the plaintext of every note both
arrive on the first overlay open rather than in the `(app)` layout chunk, which loads on every
page. That is worth about 20 kB of the chunk, and it is the only reason the overlays never name
`getSearchIndex`.

`SearchWindow.svelte` and `FilterWindow.svelte` are **deleted**, along with the `/search` and
`/filter` routes that rendered them. What is left in here is the three pieces the overlays are
built out of, and two rules the deleted windows encoded that had to survive into them:

- **`await index.ready()` before every `search()`.** Construction is `addAllAsync`, so a query
  typed straight after the overlay opens would otherwise run against a half-built index
  (ISSUES.md B3, B4). The `searching` flag driving the "searching …" state is that await.
- **Filter writes one `setQueryAndResults`,** never a `setQuery` then a `setResults`. The pair it
  replaces made the graph rebuild its filtered maps and redraw twice per keystroke (ISSUES.md C11).

`SearchBar.svelte` is the input for **all three** overlays and is the panel's header row, not the
`text-xl` bordered box in the middle of a page it used to be. Three behavioural changes came with
that and are relied on:

- it fires on **`input`**, not `keydown` — `keydown` runs before the value updates, so the old
  version dispatched the text as it was one keystroke ago. The 250 ms debounce hid that; it
  surfaced at `debounceTime = 0`, which the command palette uses;
- **`value` is a prop**, so `?q=` can seed the field on open;
- **`keydown` is forwarded**, because ↑/↓/Enter must reach the result list while focus stays in
  the input.

It also exports `flush()`, which dispatches an owed debounce immediately and is **a no-op when
nothing is owed**. That guard is not cosmetic: it is what Enter calls in the filter overlay, and
an unconditional flush would hand the graph a fresh `results` array — failing the reference check
in `CanvasGraph.onFilterChange` — on every press.

`SearchMatch.svelte` is a real `<a href>` now rather than a `<div role="link">` with a no-op
`on:keydown`, so middle-click, Ctrl/Cmd-click, keyboard activation and link preloading all work.
The click is still intercepted — opening a note means writing a tile, not navigating — **except**
when Ctrl/Cmd/Shift is held, which is a request for a new tab and the browser's to honour.

It is four lines now, not one: title with the note's directory right-aligned, tag chips, a
match-centred snippet, and the `showMeta` readout. Three things in it will bite:

- **The directory comes from `match.note.path`**, the field `emitters/search.js` writes. It
  is _not_ derived from the slug — see the root `CLAUDE.md`. Guard it: `path` is `?? ''` because an
  `search.json` generated before the field existed must still render.
- **The whitespace inside the snippet `{#each}` is load-bearing.** Svelte collapses a run of
  whitespace in a text node to one space, so laying `{#if}`, `{#each}` and `</strong>` out on tidy
  separate lines renders `convexity` as `convex ity`. There is a comment above it saying so; if you
  reflow it, check the result with `compile(src, {generate: 'ssr'})`.
- **The snippet is built from `matchedFields`' keys**, so it needs no extra data — but it is per
  row, so it is also where a pathological result set would show up first.

`snippet.js` is the excerpt builder, and it is pure — no Svelte, no DOM, so it can be exercised
from `node`. `buildSnippet(content, terms)` collapses the note's paragraph newlines once, slides a
220-character window to the first matched term (a third of it as lead), snaps both ends to a space,
and returns `{parts, head, tail}` — alternating `{text, match}` runs plus whether each end was cut.
Render `parts` with an `{#each}`; **never** `{@html}`, this is note text. Two rules inside it are
deliberate and easy to "fix" wrongly:

- **A leading word boundary, and no trailing one.** minisearch tokenises with neither prefix nor
  fuzzy matching on, so a term in `matchedFields` is a whole token that really occurs in the note:
  searching `form` cannot have matched `transformers`, and bolding the `form` inside it points at
  text that had nothing to do with the hit. A _trailing_ boundary would be wrong the other way —
  it would refuse to bold the `convex` of `convexity`, which is what every good search UI does.
- **`\p{L}\p{N}` with the `u` flag, not `\b`.** `\b` is ASCII-only in JavaScript, so in `časy`
  the `č` is a non-word character and `\bčas` never matches — which breaks on exactly the notes a
  personal collection is full of.

A term that matched only `title` or `tag`, an empty query, or a note the term is not in all land on
the same fallback: the head of the note, unhighlighted. That is what the row used to always show.

`QueryDisplay.svelte` is behind the settings overlay's **metadata** toggle in both overlays, the same
switch that shows a note's frontmatter and backlinks. It takes a `margin` prop, passed through to
`InfoBox`, and both call sites pass `mb-0`: `InfoBox`'s default `mb-10` is a paragraph-break-sized
gap under a readout that sits directly above the result list, which reads as a section break that
is not there. It has to be a **prop** rather than a `class="mb-0"` from the call site because
Tailwind resolves competing utilities by stylesheet order rather than attribute order, so the call
site's would silently lose. Same reason `ToolbarItem` takes `padding` as a prop. (The old
justification — "`mb-10` is a third of a `max-h-[70vh]` panel" — died with the card; the prop did
not.)

### `overlay/`

`OverlayHost.svelte`, `OverlayShell.svelte`, `OverlayEmpty.svelte`, `focus_trap.js`,
`row_style.js`, `record_chord.js`, and one screen per kind: `SearchOverlay`, `FilterOverlay`,
`CommandOverlay`, `SettingsOverlay`, `ShortcutsOverlay`.

`OverlayHost` is the single mount point and the only thing that maps a kind to a component.
Nothing else decides what is open: the toolbar buttons, the shortcuts, two commands and
`?overlay=` all write `overlay.kind`, and this reads it. A fourth screen is a key in `OverlayKind`
plus a row in `SCREENS`.

#### Settings

`settings` and `shortcuts` are two overlay kinds, not one kind with a sub-page field: the
shortcuts screen is settings' sub-page, `?overlay=shortcuts` needs nothing new in the URL, and
`OverlayHost`'s focus restore already spans moving between kinds. Like every overlay kind they
are written with `replaceState`, so moving between them is not a back-button stop — the
"‹ Settings" button is the way back.

`SettingsOverlay` holds the `PREFS` toggle and the link into the sub-page. `ShortcutsOverlay` lists
**every** command, shortcut-only ones too, and edits `SHORTCUTS`. Neither has a `SearchBar`, so
each focuses its own first control on mount.

`record_chord.js` is the recorder, and it is the one key handler besides `AppShell`'s. It listens
on `window` in the **capture** phase and stops propagation, so `AppShell`'s bubble-phase listener
never sees the keypress — which is what makes Escape, or a chord already bound to something,
recordable instead of acted on. Bare Tab is let through and blur cancels, so the keyboard can
still leave it.

Recording a chord that another command has **moves** it (`shortcuts.add` returns the previous
owner, and the row says so) rather than refusing — refusing would leave no way to swap two keys.
The store keeps only overrides, so a command nobody rebound follows its `defaultKeys` when they
change in code, and an override equal to the defaults is dropped.

**It is mounted inside `ContentPane`, and that placement is the design.** The modal covers the
content area only, so the toolbar stays clickable and the visualization stays visible _and usable_
underneath while you search — which matters most for the filter, whose whole output is a change to
the graph. `ContentPane`'s `relative` is its anchor. The consequence is handled in
`WithAppState`: `viz` mode hides the content pane, so opening an overlay there widens the layout
back to `split` via `layout.reveal()`. `content` mode is deliberately left alone, and the reveal is
one-way — Escape leaves you in `split`.

`<svelte:component>` remounts on every change of `this`, which is what makes each screen's
autofocus fire on open and its local state start clean.

#### `OverlayShell` — one frame, and it fills the pane

The shell is **an opaque surface covering the whole content pane**, not the top-anchored card it
used to be. The card was `w-full max-w-2xl max-h-[70vh]` over a `bg-back-*/80 backdrop-blur-sm`
backdrop, offset `pt-[10vh]` — every one of those numbers measured against the _viewport_ while
the box they lived in is a `flex: (1 − vizFraction) 1 0%` share of it. At the default fraction
`max-w-2xl` never bound at all and `px-4` was the real width, while `pt-[10vh] + max-h-[70vh]` came
to 80vh inside a pane 41px shorter than the window.

Now: `absolute inset-0 z-20 flex flex-col bg-back-*`, four slots — a header, `input`, the default
body slot, and `footer`. **The shell owns the scroller** (`flex-1 min-h-0 overflow-y-auto`); the
three screens each used to write that same div and that same `<footer class="shrink-0 px-3 py-1.5
…">` out for themselves.

Details that are load-bearing:

- **The header is `h-10`, the toolbar's height**, so the two read as a stack rather than as a
  caption floating under a bar.
- **No backdrop click.** An opaque full-pane surface has no "outside" to click, so that closer is
  gone; the header's ✕ replaces it, and Escape is unchanged.
- **The body is capped at `max-w-3xl` and centred**, inside a full-width scroller so the scrollbar
  stays at the pane edge. In `content` mode the pane is the whole window, and nothing else in this
  app sets text that wide — `Prose.svelte` caps a note at 65ch for the same reason.
- **No minimum width anywhere**, `min-w-0 truncate` on the header title, `truncate` on the footers.
  `confirmFraction()` only snaps below 0.1 / above 0.9, so a live drag can leave the pane very
  narrow and the frame must not blow it out.
- **Each screen mounts its own shell.** It cannot be wrapped around `<svelte:component>` from the
  host any more: slot content is scoped to where it is written, so a screen rendered as a child
  could never fill the shell's `input` and `footer` slots.

#### Focus

Neither of these existed before; the dialog claimed `aria-modal` and enforced nothing.

- **`focus_trap.js`** is a `use:` action on the shell, and does **Tab containment only**. It
  focuses nothing on mount — `SearchBar`'s own `onMount` autofocus is the sole owner of initial
  focus, and a second claimant would race it. It never looks at Escape.
- **Focus restore is in `OverlayHost`, not the shell**, because each screen mounts its own shell:
  switching kinds (the palette's own "Search notes" command) tears one shell down and builds
  another, so a capture at shell init would record the _outgoing_ screen's input as the opener.
  The host's `{#if $overlay.kind}` spans the whole open, so it captures once, guarded on
  `!opener`. It reads `document.activeElement` in a reactive block, which Svelte runs _before_ it
  patches the DOM — the same ordering `ContentPane`'s `hold()` depends on — so the overlay does
  not exist yet and the toolbar button is still focused.

#### `OverlayEmpty` and `row_style.js`

`OverlayEmpty` is the idle / "searching …" / "no match" block. Those were a `px-3 py-6` paragraph
pinned to the top, which looks mislaid in a pane six times the height of the old card; it now
centres them with `grid place-content-center`.

`row_style.js` holds the one `border-l-2` highlight pair, which `SearchMatch` and the palette's
rows had a copy of each. Literal strings in a `.js` file are still literal to Tailwind's content
scanner, so this does not trip the computed-class-name rule — padding stays on the call sites,
because the two rows differ and a `class` passthrough would lose to the stylesheet order.

The two search-shaped screens differ in more than which store they write, and the difference is
the point:

|              | `SearchOverlay`                       | `FilterOverlay`                                  |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| Result of it | a note opens                          | the visualization is restricted                  |
| The list is  | a menu — ↑/↓ move a cursor            | a preview of what the graph will show; no cursor |
| `Enter`      | opens in the focused tile, and closes | applies now (`flush`) and **stays open**         |
| `Alt+Enter`  | opens in a new column, stays open     | —                                                |
| `Escape`     | closes                                | closes; **the filter stays applied**             |

That last cell is why `ContentSection`'s filter badge tracks `$filter.query` rather than
`$overlay.kind`, and why a "Clear filter" command exists at all.

Both funnel every open through `openNote(tiles, layout, slug, {where})` — never `goto` — and both hold a
monotonic `latest` counter, because each run awaits twice (the lazy `search.json` import, then
`index.ready()`) and nothing orders two in-flight keystrokes. Only the newest run may write its
results. Both also pass `loadSearchNotes()`'s resolved array to `getSearchIndex` **untouched**; a
copy or a spread re-indexes the corpus (ISSUES.md B3).

`overlay.setQuery` is called from inside the search handler, so `?q=` is already debounced by
`SearchBar` — there is no second timer, and no `replaceState` per keystroke.

### `commands/`

`registry.js` is a list of `{id, title, description, keywords, group, run, enabled}`, plus the
shortcut fields `defaultKeys`, `allowInInput` and `palette: false` (a shortcut-only command the
palette does not list — `overlay.commands`, `overlay.close`). Every keyboard shortcut runs a
command from here; see "Keyboard shortcuts" above. A palette row shows the command's current
chords. A command is
**data that calls a store action**; none of them touches the DOM or navigates, which is what keeps a command
and the toolbar button beside it from drifting apart.

`CommandOverlay` assembles the `ctx` bag once from context, with one mutable field: `values`, a
snapshot of the stores refreshed by a reactive statement. `enabled(ctx)` has to answer against
current state, and assigning through `ctx` invalidates it, so the list re-evaluates and a command
greys out the moment it stops being available. **Disabled commands are still listed**, greyed —
hiding them would make the palette's vocabulary depend on the state you happen to be in.

Two details that will bite whoever edits it:

- **The palette closes _before_ it runs the command.** `overlay.search` and `overlay.filter`
  _open_ an overlay; closing afterwards would immediately undo them. They `toggle` rather than
  `open` (the shortcut should close what it opened), which from the palette is the same thing
  because the overlay is already closed when they run.
- **The two visualization toggles are written against a setting name, not against the force
  graph.** `viz.updateSettings` writes into whichever visualization is active and `enabled` asks
  whether that one actually has the setting, so a second visualization needs no edit here and does
  not inherit a command that would do nothing.

`description` is **required**, not optional. The rows show one under the title, and the array is
annotated `@type {Command[]}`, so a forgotten description is an `npm run check` failure rather than
a blank line in the palette.

A row is `CommandRow.svelte`, which **scrolls itself into view** when the cursor lands on it, the
way `SearchMatch` does. The overlay used to do that from the parent via
`listEl.children[highlight]`, which only held while every child of the list was a row and the
cursor index matched a DOM position — the empty state already breaks that assumption.

`match.js` is a ~40-line subsequence scorer over `title + keywords` — **not** `description`, and
that is deliberate: matching against a sentence of prose floods the SUBSTRING and SUBSEQUENCE bands
(nearly every description contains "the") and the calibration a dozen hand-written titles was tuned
for stops meaning anything. Descriptions are there to be read, not searched.

The scoring itself: prefix beats word-boundary beats substring beats scattered subsequence, position breaks ties inside a band, and a keyword hit
is penalised against a title hit of the same shape. `sort` is stable, so equal scores keep
registry order. Do **not** reach for `minisearch` for a dozen static strings, and do not add a
second search library for them either — `flexsearch` sat in `package.json` imported by nothing
until the cleanup pass dropped it.

### `toolbar/`

One horizontal strip, `Toolbar.svelte`, in three sections:

| Section          | Width    | Contents                                                      |
| ---------------- | -------- | ------------------------------------------------------------- |
| `VizSection`     | natural  | `VizSwitcher`, then the active visualization's own `Controls` |
| `HistorySection` | `flex-1` | chips for `$history.recent`, scrolled horizontally            |
| `ContentSection` | natural  | Search, Filter, Commands, Settings, Split, Close              |

Three things in here are easy to get wrong:

- **Clicking the visualization's name cycles the layout**, it does not switch visualizations —
  that is the chevron next to it. This is the primary layout control and the mode glyph (`▯▮`
  split, `▮` viz, `▯` content) rides along on the button for that reason. It must stay visible in
  every mode: `layout.confirmFraction()` snaps to `content`-only below 0.1, the divider is
  unmounted there, and without this button a full drag left is a dead end.
- **`HistorySection` owns its own `flex-1 min-w-0`.** Without `min-w-0` a flex item will not shrink
  below its content's intrinsic width, so the chip row pushes `ContentSection` off the right edge
  instead of scrolling. It is inside the component so a caller cannot forget it.
- **`ContentSection`'s filter badge tracks `$filter.query`, not `$overlay.kind`.** Closing the
  filter overlay does not clear the filter, so "the panel is open" and "a filter is in force" are
  different questions.
- **There is no Metadata toggle in the strip.** It is a set-once preference, so it lives in the
  settings overlay (and the palette's "Toggle note metadata"). It is broader than its name: it
  gates a note's frontmatter and backlinks _and_ the parsed-query readout inside the search and
  filter overlays — both are "show me the machinery".
- **Split reveals the content pane as well** (`layout.reveal()` beside `tiles.splitRight()`), since
  the strip is on screen in every mode and a new column is invisible in `viz`.
- **Split and Close are absent when no note is open.** Both act on the focused column and there is
  none; `tiles.splitRight` is a no-op at zero tiles rather than minting a tile with an empty slug,
  which would push a "no note here" state into every consumer to describe what hiding the
  content pane already covers.

#### The button stack

`components/Button.svelte` (bare `<button>`; forwards click, auxclick, mousedown, mouseenter,
mouseleave; renders `title=`) → `ToolbarButton.svelte` (swaps between two class strings on
`active`) → `ToolbarItem.svelte` (lead slot, inline label, padding).

`DesktopToolbarButton.svelte` and the eight components in `buttons/` are deleted. The tweened
slide-out label existed only because a vertical icon strip had no room for text.

Two details of that stack changed with the redesign and should not be reverted:

- `ToolbarButton` no longer forces `text-back-*`. That was right when every button was a filled
  colour square floating over the canvas; the strip's resting state is transparent, and a
  back-coloured label on it is invisible. The text colour now travels **with** `defaultColor` /
  `activeColor`, which is the only way one component can express both a ghost and a filled state.
- It lays out with `inline-flex`, not the `grid content-center` it used to. An item is a row of
  things now — a mode glyph and a label, a label and a badge — and grid stacks them.

Colour pairs are Tailwind class strings, so they must be **literal strings**: the content scanner
cannot see a computed class name. The default pair on `ToolbarItem` is the ghost one; a call site
overrides `activeColor` to give a control its own hue.

Padding is a **prop**, not something a caller passes through `class`. Tailwind resolves competing
utilities by their order in the generated stylesheet, not by their order in the attribute, so a
`class="px-1.5"` alongside a hard-coded `px-2` silently loses.

**Items are text-only.** No icon set has been drawn yet; `ToolbarItem`'s `lead` slot is where one
goes. Note that `Search` and `Filter` shared one identical magnifier SVG in the old vertical strip,
where they were far enough apart for nobody to notice — they are adjacent now.

### `viz/`

`registry.js`, `VizPane.svelte`, and `force_graph/` — the canvas renderer, which used to live in
`src/lib/graph/`. It has its own `CLAUDE.md`; **read it before touching the renderer.**

`registry.js` is the enumeration the toolbar's switcher lists and the pane renders from. A
descriptor is `{id, label, dataId, View, Controls, defaultSettings}`; `getVisualization(id)` falls back to
the first entry rather than returning `undefined`, because `viz.activeId` is restored from
localStorage and can name a visualization that has since been renamed away. `Controls` may be
`null` and `VizSection` guards on it.

The state layer never imports this file. `(app)/+layout.svelte` passes `visualizations` into
`WithAppState`'s `vizDescriptors`, which is how `createVizState` learns each visualization's
`defaultSettings` without `state/` depending on `viz/`. There is deliberately no second copy of
those defaults.

`VizPane` supplies the visualization's `callbacks` — `{onActivate, onHover}` — rather than letting
the renderer reach for a router or a store. `onActivate` is `openNote(tiles, layout, slug)`, guarded
on `NOTES_INDEX.bySlug.has(slug)` because a graph may hold nodes that are not notes; `onHover` is
`selection.hover(toNoteRef(node))`, and the `toNoteRef` is what keeps a graph node's `x`, `y` and
`matter` out of the store (ISSUES.md B9). `callbacks` must stay a `const`: `CanvasGraph` captures
it once at mount.

`VizPane` also loads the active visualization's data itself — `getVizData(active.dataId)` from
`viz/data.js`, one lazy chunk per `generated/viz/<dataId>.json` — rather than having it threaded
down, so `AppShell` has no data to forward. See `viz/CLAUDE.md`.

### `adaptive/`

`MediaQuery.svelte` is a renderless component that dispatches `change` with a boolean.
`WithAdaptiveContext` owns the breakpoint (`max-width: 639px`, matching Tailwind's `sm`) and
publishes the `adaptive` store under the context key `adaptive` — the one legacy context left.

**Neither is mounted.** The mobile branch they gated is deleted and a mobile shell is a later
effort; `Adaptive.svelte`, the slot switch, is gone. They are kept because they are clean and
self-contained and that later effort will want them.

Their removal is why the app renders during prerender at all now: `WithAdaptiveContext` starts
`{mobile: false, desktop: false}`, so `Adaptive` rendered _neither_ slot on the server and every
prerendered page was empty. Anything that used to assume "this only runs in the browser" no longer
can.

### `components/`

`Button.svelte` and `InfoBox.svelte` — the only genuinely generic components.

## `Prose.svelte` and the max-width mechanism

Note width is controlled across _both halves of the app_. The preprocessor's
`rehypeWrapTextElems` plugin (`preprocessor/parse/plugins.js`) wraps every top-level element except
`mjx-container` in `<div class="prose-high-level-tag">`; `Prose.svelte` gives that class
`max-width: 65ch; margin: auto`. The result is centred, readable text with maths and other wide
blocks allowed to overflow full-width.

So: **changing note text width means changing both the rehype plugin and `Prose.svelte`.**
`Prose` itself is otherwise just Tailwind typography config (`prose prose-noteplot
dark:prose-invert`).
