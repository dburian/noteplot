# Noteplot

Visualization tool for a personal Markdown note collection. It renders notes as an interactive
force-directed graph next to a reading pane, and builds to a fully static site.

> **Keep this file current.** When you change code described here, update this file in the same
> commit. A CLAUDE.md that describes code which no longer exists is worse than no CLAUDE.md.
> The same rule applies to every nested CLAUDE.md listed at the bottom.

## Architecture: two halves joined by generated JSON

Noteplot is **not** a single app. It is a build-time Node preprocessor and a SvelteKit static
site that communicate only through JSON files written to `src/lib/notes/`.

### Half 1 — the preprocessor (plain Node `.js` at the repo root)

```
index.js                     commander CLI: `watch` | `build`
  └─ note_preprocessor.js    NotesUpdater — walks / watches the note directory,
                             debounces events (2s), collapses them to one per
                             path, then runs each pipeline in sequence,
                             threading one result object through them
       ├─ note_pipeline.js          markdown → HTML  →  src/lib/notes/<slug>.json
       ├─ graph_pipeline.js         d3 force layout  →  src/lib/notes/__graph.json
       └─ search_index_pipeline.js  markdown → text  →  src/lib/notes/__search.json

unify_pipelines.js           shared unified/remark/rehype plugin stacks + toSlug()
```

The pipeline contract is implicit and undocumented in code, so note it here: `NotesUpdater.on()`
calls `pipeline.on(events, previousResult)` on each pipeline in array order and passes the
return value to the next. Only `NotePipeline` produces anything new (`{notes, changes}`); the
other two read it and return it unchanged. **Order matters** — `GraphPipeline` and
`SearchIndexPipeline` both depend on `NotePipeline` having run first.

`changes` is a `slug → Set<changed key>` map, and it is not only an output: `NotePipeline` reads it
back to decide which **neighbours** to rewrite. A note's JSON embeds `{slug, title}` for each of its
links and backlinks, so one edit can invalidate files that did not change — the targets a link was
removed from, the sources of a deleted note, and, when a title changes, both sides of every edge.
`on()` therefore writes `toSave ∪ diffs.keys() ∪ resave`, not just the notes whose files moved
(`ISSUES.md` A6, A20). `GraphPipeline` iterates `events`, so the extra entries never reach it.

`unify_pipelines.js` exports two pipeline builders:

- `createRehypePipeline` — the full markdown → HTML path (MathJax, Shiki, figures, image
  copying, link/backlink collection). Used by `NotePipeline`.
- `createRetextPipeline` — markdown → stripped plaintext, for the search index. Used by
  `SearchIndexPipeline`, which **re-reads and re-parses every file from disk** rather than
  reusing `NotePipeline`'s work.

### Half 2 — the SvelteKit site (`src/`)

Reads the generated JSON via static `import`, renders the graph on a `<canvas>`, and prerenders
one page per note. See `src/routes/CLAUDE.md` and `src/lib/CLAUDE.md`.

### Generated output — never hand-edit, never commit

| Path                          | Contents                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `src/lib/notes/<slug>.json`   | one per note: HTML content, title, links, backlinks, frontmatter, reading time |
| `src/lib/notes/__graph.json`  | `{viewBox, nodes, links}` — node positions; links are `{source, target}` slugs |
| `src/lib/notes/__search.json` | array of `{slug, title, content, matter}` plaintext records                    |
| `static/note_imgs/`           | images copied out of the note directory                                        |

Both directories are gitignored and are created on demand by `NotePipeline._setupPaths`.

## Running it

Every command needs a **note directory** — the root of your Markdown collection. It is not
stored anywhere; you pass it on each invocation. It is resolved against **your** working
directory, and everything after that (vite's config, the generated JSON, the copied images)
belongs to the package — `index.js` `chdir`s into it, because SvelteKit resolves its own config
from the CWD and gives no way to override that. So the commands below work from anywhere.

```bash
npm install

# dev: vite dev server + note watcher in one process
npm run watch -- <note-dir>

# preprocessor only (useful when vite is already running elsewhere)
npm run watch:notes -- <note-dir>

# static build into ./build
node index.js build <note-dir>
npm run preview
```

`npm run dev` / `npm run build` run **vite alone** and will fail or serve stale data unless the
preprocessor has already populated `src/lib/notes/`. Prefer the `index.js` entry points.

`build` refuses a collection with no Markdown files in it — both `[slug]` routes are prerendered
from what the preprocessor wrote, so vite would otherwise fail with a confusing message about
uncrawled routes (`ISSUES.md` A18). `watch` accepts an empty directory and waits.

> **The watcher's `ignore` predicate is subtle.** `NotesUpdater._isIgnored` is handed three
> different shapes of path — absolute (from `watcher` and `tiny-readdir`), relative to the watched
> directory (from Node's own `fs.watch`, which is how every file event arrives), and ancestors of
> the note root. Any change to it must handle all three; getting this wrong silently drops every
> event. See `ISSUES.md` A0. It is also the filter `updateAll()` applies during the startup scan,
> so the scan and the watcher cannot disagree about what a note is (`ISSUES.md` A15).

### Sub-path deploys

`svelte.config.js` reads `process.env.BASE_PATH` into `kit.paths.base`. Use the env var:

```bash
BASE_PATH=/noteplot node index.js build <note-dir>
```

`--base-path` does the same thing, and also prefixes the image URLs the preprocessor writes into
each note's HTML:

```bash
node index.js build <note-dir> --base-path /noteplot
```

It works by setting `BASE_PATH` for `svelte.config.js` to read. Do **not** pass vite's own `base`
instead — SvelteKit enforces `base` and `root` and overrides whatever vite was given. Anything in
the frontend that builds a URL must prefix it with `base` from `$app/paths`.

### Checks

```bash
npm run check    # svelte-check against jsconfig.json (checkJs: true)
npm run lint     # prettier --check . && eslint .
npm run format   # prettier --write .
```

There are **no tests**. Verification is manual: run the watcher against a note directory and
exercise the UI.

## Tooling

- **SvelteKit 2** on **Svelte 4** — no runes, no `$state`/`$derived`. Use `export let`,
  `$:` reactive statements, and stores. (`WithContentState.svelte` imports `page` from
  `$app/state`, which is a newer SvelteKit API; the rest of the codebase uses `$app/stores`.)
- **`@sveltejs/adapter-static`** — the whole site prerenders. No server, no endpoints.
- **JavaScript with JSDoc types**, `checkJs: true` in `jsconfig.json`. There is no TypeScript;
  add types as JSDoc comments.
- **Tailwind** + `@tailwindcss/typography`. Custom colours (`front`/`back`/`emphasis`/`muted`,
  each with `.light`/`.dark`) and a `prose-noteplot` theme live in `tailwind.config.js`.
- **unified / remark / rehype** for markdown, **MathJax** for maths, **Shiki** for code.
- **d3** for both the build-time force layout and the runtime canvas zoom.
- **minisearch** for search and filter. (`flexsearch` is still a dependency but unused.)
- **pino** + `pino-pretty` for logging; **`watcher`** for filesystem events; **commander** for
  the CLI.

### The `virtual:tailwind-config` vite plugin

`vite.config.js` defines a virtual module that serialises the _resolved_ Tailwind config into
JS. `src/lib/graph/canvas_graph.js` imports it to get theme colours, because canvas drawing
cannot use CSS classes:

```js
import tailwindConfig from 'virtual:tailwind-config';
const tailwindColors = tailwindConfig.theme.colors;
```

This is easy to break by accident. If canvas colours go wrong, check this plugin first.

## Repo map

| Path                       | Role                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `index.js`                 | CLI entry point (`bin: noteplot`)                                      |
| `note_preprocessor.js`     | watcher, debouncing, pipeline orchestration, `saveJSON`                |
| `note_pipeline.js`         | per-note JSON, link/backlink enrichment, change diffing, `isDeepEqual` |
| `graph_pipeline.js`        | d3 force simulation, position pinning, viewBox fitting                 |
| `search_index_pipeline.js` | plaintext search index                                                 |
| `unify_pipelines.js`       | shared remark/rehype plugins, `toSlug`, the shared `logger`            |
| `src/routes/`              | pages and data loading — see `src/routes/CLAUDE.md`                    |
| `src/lib/`                 | components and state — see `src/lib/CLAUDE.md`                         |
| `src/lib/graph/`           | the canvas renderer — see `src/lib/graph/CLAUDE.md`                    |
| `static/`                  | favicons, manifest, and generated `note_imgs/`                         |
| `.tmux`                    | the author's dev session bootstrap; not part of the build              |

## Slugs

`toSlug(fullPath, noteRoot)` in `unify_pipelines.js` turns a file path into a URL slug. Slugs are
the primary key everywhere — in filenames, graph nodes, links, backlinks, search records, and URLs
— so the encoding has to be **injective**: strip the extension, then replace `~` with `~~`, then
`-` with `~-`, then `path.sep` with `-`. So `-` is the separator stand-in, `~` escapes it, and `_`
is left untouched.

| path                    | slug                 |
| ----------------------- | -------------------- |
| `math/taylor_series.md` | `math-taylor_series` |
| `dir/note.md`           | `dir-note`           |
| `dir-note.md`           | `dir~-note`          |
| `a_b.md`                | `a_b`                |
| `a-b.md`                | `a~-b`               |

Because `~` always starts a two-character token and a lone `-` is always a separator, no two paths
can produce the same slug. **Slugs are opaque** — nothing in the codebase reverse-parses one, and
nothing should. Doubling the delimiter (`-` → `--`) looks equivalent but is ambiguous at component
boundaries; see `ISSUES.md` A13.

## Known issues

`ISSUES.md` lists the known structural bugs and non-optimal paths, grouped by build pipeline,
data flow, and rendering. **Read it before "fixing" something** — many rough edges there are
already catalogued, and some apparent bugs are load-bearing.

## Nested documentation

- `src/routes/CLAUDE.md` — routing, prerendering, data loading
- `src/lib/CLAUDE.md` — component tree and the Svelte context architecture
- `src/lib/graph/CLAUDE.md` — the canvas renderer and its coordinate spaces
