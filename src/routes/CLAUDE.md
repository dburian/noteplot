# Routes

> **Keep this file current.** When you add, remove, or re-scope a route, update this file in the
> same commit.

Everything prerenders. `adapter-static` is configured with `strict: true`, so any page that
cannot be prerendered fails the build.

## Layout hierarchy

```
+layout.svelte                 imports app.css, renders <slot/>. Nothing else.
+error.svelte                  status + message, link back to the index

(graph)/+layout.js             statically imports __graph.json, `prerender = true`
(graph)/+layout.svelte         stacks the five context providers, then splits
                               desktop / mobile via <Adaptive>
```

The `(graph)` group exists so every page inside it renders **on top of a live graph canvas**.
The page's own content goes into the layout's `<slot/>`, which lands inside the content pane
(desktop) or the full-screen note overlay (mobile). See `src/lib/CLAUDE.md` for the providers.

`(graph)/+layout.js` does `import graph from '$lib/notes/__graph.json'` at module scope. That is
a _static_ import, so the entire graph is inlined into the JS bundle and loaded on every page.

## Route table

| Route                  | Renders        | Intended behaviour                                          |
| ---------------------- | -------------- | ----------------------------------------------------------- |
| `(graph)/+page.svelte` | _(empty file)_ | bare graph, no content pane                                 |
| `(graph)/[slug]`       | `NoteContent`  | graph **with that note selected**, note in the content pane |
| `(graph)/notes/[slug]` | `NoteContent`  | **note only, no graph**                                     |
| `(graph)/search`       | `SearchWindow` | full-text search; jumps to a note, leaves the graph alone   |
| `(graph)/filter`       | `FilterWindow` | full-text filter; restricts which nodes the graph shows     |

### The `[slug]` / `notes/[slug]` split is currently inert

The two routes are byte-for-byte identical except that `load` returns `withGraph: true` versus
`withGraph: false`. **Nothing reads `withGraph` or `graphFullScreen`** — grep confirms they are
write-only. The intended distinction (`notes/[slug]` shows the note without the graph) is
therefore not implemented, and both URLs currently behave the same.

The distinction matters most on **mobile**, where there is not enough room to show a graph and a
note at once. Note that a second, _working_ mechanism for the same concept already exists: the
`contentState` context and its `?onlyContent` / `?noContent` search params. Before wiring
`withGraph` up, decide which of the two mechanisms wins — having both is the actual problem.
Tracked as B7 in `ISSUES.md`.

## Data loading

Note pages load their JSON with a dynamic import keyed on the slug:

```js
const note = (await import(`$lib/notes/${params.slug}.json`)).default;
```

Vite turns this into a glob over `src/lib/notes/*.json`, so each note becomes its own chunk —
this is the one place the corpus is _not_ eagerly bundled. A missing slug throws and is caught
into `error(404, ...)`.

`search/+page.js` and `filter/+page.js` both statically import `__search.json`, which contains
the **plaintext of every note**. That whole payload ships with the bundle (ISSUES.md B2).

## Prerender enumeration

Both `[slug]` and `notes/[slug]` export an `entries()` that reads the preprocessor's output
directory off disk to enumerate pages:

```js
const noteJsons = await readdir('src/lib/notes')
return noteJsons.filter(n => !n.startsWith("__")).map(...)
```

Two consequences worth knowing:

- The routes are **coupled to the preprocessor's output path**, and to it being relative to the
  process CWD. Running the build from another directory breaks it (ISSUES.md A12).
- The `__`-prefix convention is what keeps `__graph.json` and `__search.json` from being treated
  as notes. Do not name a generated file without that prefix.

The two `entries()` implementations are duplicated verbatim (ISSUES.md B10).

## Slugs and route collisions

Slugs come from `toSlug` in `unify_pipelines.js` — see the root `CLAUDE.md`. Because notes are
served from the root path, **a note whose slug is `search` or `filter` is shadowed by those
routes** and becomes unreachable. There is no guard against this.

## Link conventions

Anything that builds a URL must prefix it with `base` from `$app/paths`, or it breaks on
sub-path deploys:

```js
import { base } from '$app/paths';
goto(`${base}/${slug}`);
```

Two places currently get this wrong: `NoteMetaContent` uses relative `./${slug}` hrefs (B12),
and the Search/Filter toolbar buttons compare `$page.url.pathname` against a base-less literal
(B6).
