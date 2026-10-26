# Noteplot

Visualization tool for a personal Markdown note collection. It renders notes as an interactive
force-directed graph next to a reading pane, and builds to a fully static site.

> **Keep this file current.** When you change code described here, update this file in the same
> commit. A CLAUDE.md that describes code which no longer exists is worse than no CLAUDE.md.
> The same rule applies to every nested CLAUDE.md listed at the bottom.

## Architecture: two halves joined by generated JSON

Noteplot is **not** a single app. It is a build-time Node preprocessor and a SvelteKit static
site that communicate only through JSON files written to `src/lib/generated/`.

### Half 1 — the preprocessor (`preprocessor/`, plain Node)

```
index.js                          commander CLI: `watch` | `build`
  └─ preprocessor/index.js        preprocess(): scan → parse → corpus → emitters
       ├─ scan.js                 startup walk + `watcher`; coalesces events, serialises batches
       ├─ parse/                  one note → one NoteRecord (pure; cached; worker pool)
       ├─ corpus.js               all records + derived backlinks; apply() → ChangeSet
       ├─ emitters/               one per output; the registry is emitters/index.js
       ├─ writer.js               skip-identical, atomic writes; prunes stale output
       └─ cache.js                .cache/noteplot/: parsed records, graph positions, manifest
```

The contracts are JSDoc typedefs in `preprocessor/types.js`; read that file first. A batch flows
like this:

1. **Parse.** `NoteParser` reads each path, hashes it, and looks the hash up in the record cache.
   Misses go through `parse/parse_note.js`. It parses the Markdown **once**, then clones the tree
   into an HTML branch (MathJax, Shiki, figures) and a plaintext branch (for search). The result is
   a `NoteRecord`: a pure function of the file's bytes, its path, and the config. Nothing in
   `parse/` reads another note, and nothing in it logs. Warnings come back as data, because this
   code also runs in worker threads. The frontmatter's `created` becomes `record.created` (ms at
   UTC midnight, or `null` with a warning). The one exception to purity is `mtimeMs`:
   `NoteParser` attaches the file's mtime **after** the cache lookup, never stores it, and only to
   records whose `created` is `null`. It is the date graph's fallback.
2. **Corpus.** `Corpus.apply({upserts, removals})` is the only mutation. It owns `backlinks` and
   returns a `ChangeSet`: `added`, `removed`, `changed` (slug → which fields differ, with
   `backlinks` marked on link targets), `neighbours` (notes whose JSON embeds a title that moved),
   and `previous` (the old records). Whether a note is new is decided here, not from the watcher's
   event type.
3. **Emitters.** Each one declares `deps` (record fields). The orchestrator runs it when the batch
   is cold, when a note was added or removed, or when a changed field is in `deps`. Emitters only
   read the corpus, so they run concurrently. A body-only edit therefore rewrites that note's JSON
   and `search.json`, and leaves the graphs alone.

**Adding an output is one entry in `preprocessor/emitters/index.js`.** A new graph is a
`defineGraphEmitter({id, deps, build, layout})` (see `emitters/graph/tags.js`). `build` maps the
corpus to `{nodes, links}`, and `define_graph.js` handles position persistence, pinning, the
layout and the output file. `build` may also pin a node's x itself (`fx`), so the persisted y is
reused only while x is unchanged. It may also return `extra` keys for the output file. The date
graph (`emitters/graph/dates.js`) does both: x is the note's date, and `timeAxis` maps it back to
time. Its layout sets `translate: false` so that x stays absolute. A matching visualization is a descriptor in `src/lib/viz/registry.js`
whose `dataId` is the graph's `id`. Graph nodes that are not notes need a slug containing `/`,
which `toSlug` can never produce. `VizPane` opens only nodes that are notes.

Neighbour rewrites are why `changed`/`neighbours` exist. A note's JSON embeds `{slug, title}` for
each of its links and backlinks, so one edit can invalidate files that did not change: the targets
a link was removed from, the sources of a deleted note, and, when a title changes, both sides of
every edge (`ISSUES.md` A6, A20). `emitters/notes.js` rewrites all of them.

Images: an image's copy in `static/note_imgs/` is named after the **image's** path, not the
referring note's, so two notes embedding the same file share one copy. `emitters/assets.js` keeps
the set of destinations the whole corpus refers to and removes a copy only when it leaves that set.
It copies only what is missing or older than its source. Image files are not watched: an image
edited in place is picked up on the next start, or the next save of a note that embeds it.

**Performance, as measured on `test_notes` (135 notes):**

- The old pipeline took ~18.5 s per start, ~14 s of it in the force layout.
- Now a warm start (cache present, nothing changed) takes ~60 ms and writes no files.
- A cold start is dominated by the full force layout: ~18 s per graph, with the graphs running in
  parallel in worker threads (`emitters/graph/layout.js` `runLayout`). The date graph is the
  exception at ~0.6 s, because only y moves and its layout decays ~100× faster.
- Positions persist per note root, so only nodes without a position are relaxed (100 ticks among
  the pinned ones).
- Parsing costs ~3 s of MathJax/Shiki start-up, then ~5–7 ms per note. Worker threads repay their
  own start-up only above ~300 cold misses (`PARSE_POOL_THRESHOLD`).
- In `watch`, a save reaches its JSON in ~0.5 s. The parser is warmed once `watcher` is ready, so
  the first save does not pay the start-up.

The record cache is keyed on a fingerprint of the parser's own source files and
`package-lock.json`, so editing a plugin or upgrading a dependency invalidates it by itself. It is
also keyed on `imgUrl` (so `--base-path` invalidates), the note's absolute path, and its bytes.
Deleting `.cache/` is always safe; it costs one cold start.

Every startup scan (`build` and `watch`) is followed by sweeps that delete what the corpus does not account for:
`writer.pruneUnemitted()` (JSON of notes deleted while the preprocessor was down), each emitter's
`afterColdScan` (orphaned images), and stale cache records. All of them are **skipped if any note
failed to parse**, because the corpus is then incomplete. One bad note costs that note, not the
batch.

### Half 2 — the SvelteKit site (`src/`)

Reads the generated JSON through lazy `import()`s, and prerenders one page per note.
`(app)/+layout.js` loads only `index.json`. Notes come through `notes_route.js`, and each
visualization's data through `$lib/viz/data.js`, keyed by the descriptor's `dataId`, so only the
graph on screen is fetched.

The shape is a conventional application shell: `src/routes/(app)/+layout.svelte` mounts one state
provider (`$lib/state/WithAppState.svelte`) and one shell (`$lib/shell/AppShell.svelte`) — a
toolbar strip across the top, and below it a visualization pane and a content pane as real flex
siblings with a draggable divider between them. The URL carries the whole layout; `?layout=`,
`?tile=`, `?overlay=` and friends are documented in `src/routes/CLAUDE.md`.

The content pane is itself **N columns side by side**, each holding one note in its own scroll
container. Every column loads its own note the same way, through `notes_route.js`'s cache; the
route's pages render nothing at all. Nothing scrolls the window, so scroll restoration across
back/forward is implemented by hand in `src/lib/content/scroll_memory.js`.

Full-text search runs in a **Web Worker** (`$lib/search/search.worker.js`), started when a
search or filter overlay opens. The worker downloads `search.json` (bodies only) and builds the minisearch index; the page
sends it `index.json`'s titles, paths and matter, and gets slugs and snippets back. The design is
sized for about **10k notes** (measured: ~6 s to build in the worker, 5–20 ms per query, ~1 KB
gzipped per note to download). Well past that, the download and the build call for a sharded,
per-term static index instead. See `src/lib/CLAUDE.md`'s `search/` section.

Search, filter, the command palette and settings (with its keyboard-shortcuts sub-page) are
**modal overlays over the content area**, not routes —
`$lib/overlay/OverlayHost.svelte`, mounted inside the content pane so the toolbar stays clickable
and the visualization stays visible and usable underneath. Which one is open is one field in one
store, mirrored into `?overlay=`. See `src/routes/CLAUDE.md` and `src/lib/CLAUDE.md`.

The redesign is feature-complete; what is left is the cleanup and documentation pass in
`ISSUES.md` and the plan. There is **no mobile layout** — the half-finished mobile branch was
deleted rather than carried along, and a mobile shell is a later effort.

### Generated output — never hand-edit, never commit

| Path                                  | Contents                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/generated/notes/<slug>.json` | one per note: `html`, title, links, backlinks, matter, reading time, path(s)                                                            |
| `src/lib/generated/index.json`        | `[{slug, title, path, matter}]` — the frontend's `NOTES_INDEX`                                                                          |
| `src/lib/generated/search.json`       | `[{slug, content}]` plaintext bodies, read only by the search worker                                                                    |
| `src/lib/generated/viz/<id>.json`     | one per graph emitter: `{viewBox, nodes, links}`; links are `{source, target}` slugs; plus `extra` keys, e.g. `dates.json`'s `timeAxis` |
| `static/note_imgs/`                   | images copied out of the note directory                                                                                                 |
| `.cache/noteplot/`                    | parsed records, graph positions, the write manifest — disposable                                                                        |

All three are gitignored and created on demand. Each kind of output has its own directory, so no
filename prefix is reserved (the old `__graph.json` / `__search.json` convention is gone).

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

# same, but reachable from other machines
npm run watch -- <note-dir> --host

# preprocessor only (useful when vite is already running elsewhere)
npm run watch:notes -- <note-dir>

# static build into ./build
node index.js build <note-dir>
npm run preview
```

`npm run dev` / `npm run build` run **vite alone** and will fail or serve stale data unless the
preprocessor has already populated `src/lib/generated/`. Prefer the `index.js` entry points.

`--host` is a **global** option (declared on the program, not on `watch`), so every command
accepts it; only `watch` uses it, where it becomes vite's `server.host`. A bare `--host` binds
every interface, `--host <address>` binds that one, and omitting it keeps vite's localhost-only
default. `build` tolerates the flag as a no-op. Because the value is optional, commander swallows
the next token as the address, so `noteplot watch --host <note-dir>` reads the note directory as a
host name — put `--host` after the note directory, or write `--host=0.0.0.0`. Vite's own CLI has
the same footgun.

`build` refuses a collection with no Markdown files in it — both `[slug]` routes are prerendered
from what the preprocessor wrote, so vite would otherwise fail with a confusing message about
uncrawled routes (`ISSUES.md` A18). `watch` accepts an empty directory and waits.

> **The watcher's `ignore` predicate is subtle.** `NoteScanner.isIgnored` (`preprocessor/scan.js`) is handed three
> different shapes of path — absolute (from `watcher` and `tiny-readdir`), relative to the watched
> directory (from Node's own `fs.watch`, which is how every file event arrives), and ancestors of
> the note root. Any change to it must handle all three; getting this wrong silently drops every
> event. See `ISSUES.md` A0. It is also the filter `listNotes()` applies during the startup scan,
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
  `$:` reactive statements, and stores. `page` always comes from `$app/stores`.
- **`@sveltejs/adapter-static`** — the whole site prerenders. No server, no endpoints.
- **JavaScript with JSDoc types**, `checkJs: true` in `jsconfig.json`. There is no TypeScript;
  add types as JSDoc comments.
- **Tailwind** + `@tailwindcss/typography`. Custom colours (`front`/`back`/`emphasis`/`muted`,
  each with `.light`/`.dark`) and a `prose-noteplot` theme live in `tailwind.config.js`.
- **unified / remark / rehype** for markdown, **MathJax** for maths, **Shiki** for code.
- **d3** for both the build-time force layout and the runtime canvas zoom.
- **minisearch** for search, filter, and nothing else, inside a Web Worker — the command palette scores its dozen
  static strings by hand in `src/lib/commands/match.js`.
- **pino** + `pino-pretty` for logging; **`watcher`** for filesystem events; **commander** for
  the CLI.

### The `virtual:tailwind-config` vite plugin

`vite.config.js` defines a virtual module that serialises the _resolved_ Tailwind config into
JS. `src/lib/viz/force_graph/canvas_graph.js` imports it to get theme colours, because canvas drawing
cannot use CSS classes:

```js
import tailwindConfig from 'virtual:tailwind-config';
const tailwindColors = tailwindConfig.theme.colors;
```

This is easy to break by accident. If canvas colours go wrong, check this plugin first. Its type
lives in `src/virtual-tailwind-config.d.ts` — its own ambient file, because `src/app.d.ts` ends in
`export {}`, and a `declare module` inside a module is an augmentation of an existing one, which a
virtual module is not.

## Repo map

| Path                     | Role                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `index.js`               | CLI entry point (`bin: noteplot`)                                     |
| `preprocessor/`          | the build-time half — see "Half 1" above; contracts in `types.js`     |
| `preprocessor/parse/`    | remark/rehype plugins, the single-parse `NoteRecord` builder, workers |
| `preprocessor/emitters/` | one module per output; `index.js` is the registry                     |
| `src/routes/`            | pages and data loading — see `src/routes/CLAUDE.md`                   |
| `src/lib/`               | components and state — see `src/lib/CLAUDE.md`                        |
| `src/lib/state/`         | the stores and the URL contract — see `src/lib/CLAUDE.md`             |
| `src/lib/shell/`         | the flex application shell and the pane divider                       |
| `src/lib/content/`       | the content pane's columns, and their scroll memory                   |
| `src/lib/toolbar/`       | the three-section top strip and its button stack                      |
| `src/lib/overlay/`       | the modal host and the search / filter / command screens              |
| `src/lib/commands/`      | the command registry (also every shortcut's action and default keys)  |
| `src/lib/search/`        | the shared input, result row, query parser, and the search worker     |
| `src/lib/viz/`           | the registry, the pane that hosts it, and the force graph renderer    |
| `static/`                | favicons, manifest, and generated `note_imgs/`                        |
| `.tmux`                  | the author's dev session bootstrap; not part of the build             |

## Slugs

`toSlug(fullPath, noteRoot)` in `preprocessor/slug.js` turns a file path into a URL slug. Slugs are
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

If you need a note's **location** — the search results show one — take it from the `path` field
the preprocessor writes into `index.json` (`toDisplayPath` in
`preprocessor/slug.js`), which is the file's path relative to the note root with `/` separators. That field exists precisely so nothing has to invert `toSlug`:
`edge/a-b.md` slugs to `edge-a~-b`, and a naive `split('-')` gets it wrong in a way that looks
right on most notes.

## Known issues

`ISSUES.md` lists the known structural bugs and non-optimal paths, grouped by build pipeline (A),
data flow (B), rendering (C), and scope the UI redesign deliberately did not take (D). **Read it
before "fixing" something** — many rough edges there are already catalogued, and some apparent bugs
are load-bearing.

## Nested documentation

- `src/routes/CLAUDE.md` — routing, prerendering, data loading
- `src/lib/CLAUDE.md` — component tree and the Svelte context architecture
- `src/lib/viz/CLAUDE.md` — the registry contract, the canvas renderer, and its coordinate spaces
