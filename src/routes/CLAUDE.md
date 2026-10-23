# Routes

> **Keep this file current.** When you add, remove, or re-scope a route, update this file in the
> same commit.

Everything prerenders. `adapter-static` is configured with `strict: true`, so any page that
cannot be prerendered fails the build.

**Pages now render on the server.** They did not use to: `Adaptive.svelte` initialised with both
`mobile` and `desktop` false and so rendered neither slot, which meant every prerendered note page
was an empty shell filled in on hydration. That gate is gone, and the prerendered HTML contains
the real note body. The consequence to remember is that **everything in the tree runs during
prerender** — any `window`, `localStorage` or `sessionStorage` access needs a guard.

## Layout hierarchy

```
+layout.svelte               imports app.css, renders <slot/>. Nothing else.
+error.svelte                status + message, link back to the index

(app)/+layout.js             dynamically imports __graph.json, `prerender = true`
(app)/+layout.svelte         <WithAppState nodes vizDescriptors><AppShell/>  — no page slot
```

The group was called `(graph)` and is now `(app)`: it is not "the graph group" any more, it is the
whole application. Route groups do not appear in URLs, so the rename changed no paths.

`(app)/+layout.svelte` is a handful of lines. It mounts the single state provider
(`$lib/state/WithAppState.svelte`, the only `setContext` call site in the app) and the shell
(`$lib/shell/AppShell.svelte`, a toolbar strip over a flex row of visualization pane, divider and
content pane). See `src/lib/CLAUDE.md`.

**It renders no `<slot/>`, and the pages under it are empty files.** A page used to reach the
content pane through a chain of three of them and be rendered by one column; see the route table
below for what replaced it. A page that needs markup of its own has to re-introduce a target for it
_and_ decide where in the shell it goes, which is exactly the decision that chain was making
implicitly.

It is also the **only** place `$lib/viz/registry.js` meets `$lib/state/`: it passes the registry's
descriptors in as `vizDescriptors`, so `createVizState` learns each visualization's
`defaultSettings` without the state layer importing the visualization layer. Do not "simplify" that
by importing the registry inside `WithAppState`.

`(app)/+layout.js` does `await import('$lib/notes/__graph.json')` **inside `load`**. It must stay
a dynamic import: a static one is inlined into the JS bundle by Vite, so the entire graph would load
with every page (ISSUES.md B2). `load` runs at build time for the prerender and in the browser on
navigation either way, so nothing else changes.

## Route table

| Route                | Renders        | Behaviour                                                 |
| -------------------- | -------------- | --------------------------------------------------------- |
| `(app)/+page.svelte` | _(empty file)_ | no note open — `tiles: []`, so only the visualization     |
| `(app)/[slug]`       | _(empty file)_ | the note in the content pane, alongside the visualization |
| `(app)/notes/[slug]` | _(empty file)_ | **note only** — the pathname seeds `layout: 'content'`    |

**Every `+page.svelte` here is empty; the `+page.js` files do all the work.** A route's `load` still
returns `{note}` — `WithAppState` reads it to seed the selection, and calling `loadNote` is what puts
the note into `notes_route.js`'s cache — but nothing renders it from there. Each column of the
content pane renders its own note out of that cache, so **the prerendered HTML is full of the real
note because `ContentPane` resolves the path's note synchronously**, not because a page component
was threaded into one column.

That threading is what was removed, and why: the column holding the page was the one whose slug
matched `$page.data.note.slug`, which moved on every split, so the column handing it over was
destroyed and rebuilt for a note that had not changed — a visible flicker plus a lost scroll
position. See `content/` and `notes_route.js` in `src/lib/CLAUDE.md`.

`/search` and `/filter` **are gone**. Search, filter and the command palette are modal overlays
over the content area, reachable from anywhere and encoded in `?overlay=`. Their route directories
were deleted; the components under `src/lib/search/` survive and are rebuilt into overlays.

One consequence worth recording: a note whose slug is `search` or `filter` is no longer shadowed
by a route. Notes are still served from the root path, so a slug colliding with a _future_ route
would be, and there is still no guard against that.

### The `[slug]` / `notes/[slug]` split runs through the URL state

Both routes call the same `loadNote` / `noteEntries` and their `load` functions are identical.
What separates them is the **pathname**: `readUrlState` in `$lib/state/url_state.js` seeds
`mode: 'content'` for any path under `${base}/notes/`, and `buildUrl` omits `?layout=content`
there because the path already says it.

The pathname **seeds** the mode, it does not own it. An explicit `?layout=` wins, and cycling the
layout from a `/notes/` page writes one. Nothing in the UI links to `/notes/<slug>` — it is a URL
you type or share.

## The query-param contract

`$lib/state/url_state.js` is the only module that reads or writes the URL. The full form:

```
/<focused-slug>?tile=<slug>&tile=<slug>&focus=<n>&layout=<mode>&overlay=<kind>&q=<query>
```

| Part      | Meaning                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| path      | the focused tile's slug — redundant with `tile`/`focus`, and deliberately so  |
| `tile`    | **repeated once per column**, in order. Omitted when there is one tile        |
| `focus`   | index into that list. Omitted when `0` or when there is one tile              |
| `layout`  | `viz` \| `content`. Omitted for the `split` default and under `/notes/`       |
| `overlay` | `search` \| `filter` \| `commands`. Omitted when closed                       |
| `q`       | the overlay's query. Omitted when the overlay is closed or the query is empty |

The path stays in the URL because it is what keeps the `[slug]` route, its `load`, and
prerendering working untouched — and it keeps the common single-note URL clean and shareable.
`tile` is repeated rather than comma-joined because `toSlug` escapes only `~` and `-`, so a slug
may legally contain a comma.

The legacy `?onlyContent` / `?noContent` params are gone; `buildUrl` strips them if it sees them.

**None of these params exist on the server.** `url_state.js`'s `params()` returns an empty
`URLSearchParams` unless `window` is defined, because the prerendered HTML for `/<slug>` is one
file serving every query string — reading them at build time would bake one guess into all of
them. So the server always renders the default: split layout, one tile, no overlay. The real state
is applied by the client's own `readUrlState` at hydration, which is a flash of the default layout
on a deep link and not a bug. Verify layout deep links **in the browser**; `curl` will always show
you `split`.

Two rules govern who writes what, and they are documented in full in `src/lib/CLAUDE.md`:
**changing the path is a `goto`** (it should be a back-button stop), **changing query params is an
`href`-guarded `replaceState`** (layout fiddling must not fill the back stack).

The path is written from exactly one place — a reactive block in `WithAppState` that `goto`s
whenever the focused tile's slug and the path's slug disagree. Nothing else navigates, which is
what makes closing or splitting a column update the URL without either operation knowing about
routing. Both URL-writing blocks are gated on `$navigating === null`, because SvelteKit updates
the `page` store and flushes Svelte _before_ running `afterNavigate`; see `src/lib/CLAUDE.md`.

## Data loading

Both note routes are three lines over `src/lib/notes_route.js`, which owns the one glob of the
generated JSON:

```js
const noteModules = import.meta.glob('$lib/notes/*.json'); // slug -> lazy loader
export function getNote(slug); //         Note | Promise<Note>, memoised per slug
export async function loadNote(slug); //  error(404) on a miss; warms the same cache
export function noteEntries(); //         [{slug}, ...] for prerendering
export function loadSearchNotes(); //     the memoised __search.json promise
```

`getNote` is what the content pane's columns call, and the two share one cache — which is the link
between a route's `load` and a prerendered page having the note in it. Its rules are in
`src/lib/CLAUDE.md`; the one to know here is that **it returns the same reference for the same
slug**, and an `async` function cannot.

It also holds the `Note` typedef — the frontend's description of what `note_pipeline.js` writes
into each `<slug>.json`. It is a description and not a contract: nothing validates it, so it has
to be kept in step with the preprocessor by hand. `NoteContent` takes one prop of that type.

The glob is **not eager**: it compiles to an object of `() => import(...)` thunks, so each note is
still its own chunk and a page fetches only the note it is showing. That is not a change — Vite's
`dynamic-import-vars` plugin already compiled the previous slug-keyed dynamic import into exactly
this object. The difference is that the map now lives in one shared chunk instead of being
duplicated into both route chunks, and a missing slug 404s from a `Map` miss rather than from a
caught import rejection.

`loadSearchNotes()` replaces the two deleted `search/+page.js` and `filter/+page.js` loaders. It
is **not** in `(app)/+layout.js`: `__search.json` is the plaintext of every note, and only a
visitor who actually opens an overlay should pay for it. Two properties are load-bearing:

- the `import()` is dynamic, for the same reason as the glob (ISSUES.md B2);
- it returns the **same promise**, and therefore the same array, every time. `getSearchIndex` in
  `src/lib/search/search_index.js` memoises one built index on that array's identity, so a copy or
  a spread would silently re-index the whole corpus.

The overlays do not call it directly — they go through `src/lib/search/lazy_index.js`, which pairs
it with a dynamic `import()` of `search_index.js` itself. That second one matters for the same
reason: the overlays are mounted by `(app)/+layout.svelte`, so a static import would pull
`minisearch` into the chunk **every** page loads.

## Prerender enumeration

`noteEntries()` enumerates the pages to prerender from the same glob, so nothing reads a directory
at runtime and nothing depends on the process CWD.

Two things worth knowing:

- The routes are still **coupled to the preprocessor's output path** — `$lib/notes/*.json` is
  written into the glob pattern — but only in that one module, and Vite resolves it relative to the
  package rather than to wherever the build was started.
- The `__`-prefix convention is what keeps `__graph.json` and `__search.json` from being treated as
  notes; `notes_route.js` is now the single place it is enforced. Do not name a generated file
  without that prefix.

In dev, Vite re-evaluates the glob when a file appears, so a note added while the watcher is
running is reachable without restarting vite. Verified by hand — worth re-checking if this module
changes.

## `document.title`

`src/app.html` carries **no** `<title>`. A hard-coded one sits before `%sveltekit.head%` and
browsers take the first, so every prerendered note page shipped the title "Noteplot" and only got
its real one on hydration. `$lib/content/ContentPane.svelte` owns the title now and emits one in
every state, including "no note open" — and it has to, since the pages render nothing at all.
`+error.svelte` renders outside the `(app)` layout, so the content pane is not mounted there and it
carries its own.

## Slugs

Slugs come from `toSlug` in `unify_pipelines.js` — see the root `CLAUDE.md` for the encoding. They
are **escaped and therefore opaque**: `-` separates path components and `~` escapes a literal `-`,
so never split a slug on `-` to recover a path. Pass `params.slug` through as the key it is.

## Link conventions

Anything that builds a URL must prefix it with `base` from `$app/paths`, or it breaks on
sub-path deploys:

```js
import { base } from '$app/paths';
goto(`${base}/${slug}`);
```

`url_state.js` exports `notePath(slug)` and `indexPath()` for exactly this; use them rather than
building the string again. `NoteMetaContent`'s reference/backlink hrefs are `` `${base}/${slug}` ``
(was a relative `./${slug}`, B12), and `+error.svelte`'s "Go to index" link goes through
`indexPath()` — it was a bare `href="/"`, which left the site entirely under a sub-path deploy.
That page is outside the `(app)` layout, so it imports `url_state.js` directly; the module holds
nothing but `base` and pure functions, so there is no provider to miss.
