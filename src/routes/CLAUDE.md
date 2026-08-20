# Routes

> **Keep this file current.** When you add, remove, or re-scope a route, update this file in the
> same commit.

Everything prerenders. `adapter-static` is configured with `strict: true`, so any page that
cannot be prerendered fails the build.

## Layout hierarchy

```
+layout.svelte                 imports app.css, renders <slot/>. Nothing else.
+error.svelte                  status + message, link back to the index

(graph)/+layout.js             dynamically imports __graph.json, `prerender = true`
(graph)/+layout.svelte         stacks the five context providers, then splits
                               desktop / mobile via <Adaptive>
```

The `(graph)` group exists so every page inside it renders **on top of a live graph canvas**.
The page's own content goes into the layout's `<slot/>`, which lands inside the content pane
(desktop) or the full-screen note overlay (mobile). See `src/lib/CLAUDE.md` for the providers.

`(graph)/+layout.js` does `await import('$lib/notes/__graph.json')` **inside `load`**. It must stay
a dynamic import: a static one is inlined into the JS bundle by Vite, so the entire graph would load
with every page (ISSUES.md B2). `load` runs at build time for the prerender and in the browser on
navigation either way, so nothing else changes.

## Route table

| Route                  | Renders        | Behaviour                                                   |
| ---------------------- | -------------- | ----------------------------------------------------------- |
| `(graph)/+page.svelte` | _(empty file)_ | bare graph, no content pane                                 |
| `(graph)/[slug]`       | `NoteContent`  | graph **with that note selected**, note in the content pane |
| `(graph)/notes/[slug]` | `NoteContent`  | **note only, no graph**                                     |
| `(graph)/search`       | `SearchWindow` | full-text search; jumps to a note, leaves the graph alone   |
| `(graph)/filter`       | `FilterWindow` | full-text filter; restricts which nodes the graph shows     |

### The `[slug]` / `notes/[slug]` split runs through `contentState`

Both routes call the same `loadNote` / `noteEntries` (see below) and their `load` functions are
now identical. What separates them is the **pathname**:
`WithContentState.svelte`'s `extractContentSwitcherStateFromUrl` sets `onlyContent` for any path
under `${base}/notes/`, exactly as `?onlyContent` does. Desktop then snaps the content pane to the
full window and the graph is covered; mobile shows its full-screen note overlay. The distinction
matters most on mobile, where there is not enough room for a graph and a note at once.

There used to be a second mechanism for the same concept — `withGraph` and `graphFullScreen`,
returned by four `load` functions and read nowhere, so `notes/[slug]` behaved exactly like
`[slug]`. Having two was the actual problem, so the flags are gone and `contentState` is the one
code path (ISSUES.md B7).

The pathname **seeds** the state rather than owning it. A `reset()` from the toolbar clears
`onlyContent` for the session, but the store is re-derived from the URL on the next navigation, so
a reload of `/notes/<slug>` is note-only again. Nothing in the UI links to `/notes/<slug>` — it is
a URL you type or share.

## Data loading

Both note routes are three lines over `src/lib/notes_route.js`, which owns the one glob of the
generated JSON:

```js
const noteModules = import.meta.glob('$lib/notes/*.json'); // slug -> lazy loader
export async function loadNote(slug); //  error(404) on a miss
export function noteEntries(); //         [{slug}, ...] for prerendering
```

The glob is **not eager**: it compiles to an object of `() => import(...)` thunks, so each note is
still its own chunk and a page fetches only the note it is showing. That is not a change — Vite's
`dynamic-import-vars` plugin already compiled the previous slug-keyed dynamic import into exactly
this object. The difference is that the map now lives in one shared chunk instead of being
duplicated into both route chunks, and a missing slug 404s from a `Map` miss rather than from a
caught import rejection.

`search/+page.js` and `filter/+page.js` load `__search.json` — the **plaintext of every note** —
the same way, with `await import()` inside `load`. So that payload is fetched only by visitors who
open the search or filter pane. Both hand the array straight through as `data.searchNotes`, without
copying it: `getSearchIndex` in `src/lib/search/search_index.js` memoises the built index on that
array's identity, and a spread would defeat it.

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

## Slugs and route collisions

Slugs come from `toSlug` in `unify_pipelines.js` — see the root `CLAUDE.md` for the encoding. They
are **escaped and therefore opaque**: `-` separates path components and `~` escapes a literal `-`,
so never split a slug on `-` to recover a path. Pass `params.slug` through as the key it is.

Because notes are served from the root path, **a note whose slug is `search` or `filter` is
shadowed by those routes** and becomes unreachable. There is no guard against this.

## Link conventions

Anything that builds a URL must prefix it with `base` from `$app/paths`, or it breaks on
sub-path deploys:

```js
import { base } from '$app/paths';
goto(`${base}/${slug}`);
```

Both halves of this hold now: `NoteMetaContent`'s reference/backlink hrefs are `` `${base}/${slug}` ``
(was a relative `./${slug}`, B12), and the Search/Filter toolbar buttons compare
`$page.url.pathname` against `` `${base}/search` `` / `` `${base}/filter` `` (B6).
