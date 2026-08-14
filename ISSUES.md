# Known issues

Structural bugs and non-optimal paths found in a full read of the repo. Grouped by area,
roughly ranked within each group. Line references are anchors, not guarantees — they will drift.

**Read this before fixing something.** Several items look like small bugs but are symptoms of a
design decision that was started and never finished; those are marked as such.

Most findings come from reading the code. A0 and B1 were additionally **reproduced** by running
the preprocessor against a scratch note collection and inspecting its output. Everything else is
unverified at runtime — treat line-level details as a starting point, not as a guarantee.

Status legend: unmarked = open; **fixed** = fixed and verified, kept for the record because the
surrounding text explains the mechanism.

---

## A. Build pipeline — correctness

### A0. Watch mode never picks up any change — **fixed**

`note_preprocessor.js`, `NotesUpdater.watch()`. The `ignore` predicate assumed it was always
handed an absolute path:

```js
const relPath = path.relative(this.config.noteRoot, absPath);
if (/^\./.test(relPath)) return true; // "starts with a dot"
```

`ignore` is in fact called with **three** different shapes of path, confirmed by tracing the
call sites:

- absolute paths, from `watcher` itself (`watchPath`, `watchDirectories`) and from `tiny-readdir`;
- paths **relative to the watched directory** (`alpha.md`), from **Node's own**
  `FSWatcher._ignoreMatcher` — `watcher` forwards the predicate to `fs.watch`'s `ignored`
  option, and this is how every file event arrives;
- **ancestors** of `noteRoot` (`/tmp/npnotes`, `/tmp`), which `watcher` walks up so it can
  notice the note root itself being created or removed.

For the relative shape, `path.relative(noteRoot, 'alpha.md')` resolved `alpha.md` against the
**process CWD**, producing `../alpha.md` — which starts with `.` and was therefore ignored. The
ancestor shape produced `..` and was rejected for the same reason.

**Every add, change, and unlink event inside the note tree was silently dropped.** Live reload
did not work at all; the only thing that ever populated `src/lib/notes/` was the `updateAll()`
scan at startup, which bypasses the watcher. This is why it looked like it worked — you got your
notes on launch and nothing after.

Fixed by resolving the incoming path against `noteRoot` first, then testing each **segment** for
a leading dot (skipping `.` and `..`) rather than testing the joined relative path.

This bug **masked A2, A3, A7 and A10**: those crash paths could not be reached at all.

### A1. `isDeepEqual`'s array branch always returns `true`

`note_pipeline.js` — `new Array(a.length).every(...)` iterates a **sparse** array, and `.every`
skips holes, so the callback never runs.

Arrays are therefore never actually compared. Consequences:

- `images` never enters `diffKeys`, so **images removed from a note are never deleted** from
  `static/note_imgs/`.
- The object branch compares key _sets_ with `isDeepEqual(aKeys, bKeys)` — also arrays — so an
  added or removed frontmatter key goes undetected. (Values are still compared, because the loop
  over `aKeys` runs regardless.)

Fix: `Array.from({length: a.length}).every(...)`, or just a plain `for` loop.

### A2. Deleting a note crashes the watcher — **fixed**

`note_pipeline.js`, `_deleteNote`: `this.backlinks[link.slug].remove(note.slug)`.

Two bugs in one line — `this.backlinks` is a `Map` and was being indexed with `[]`, and `Set` has
no `.remove()` (it is `.delete()`). Now `this.backlinks.get(link.slug)?.delete(note.slug)`.

### A3. …and then `GraphPipeline` crashes on the same event — **fixed**

`graph_pipeline.js`: the `unlink` branch called `this.removeNote(notes.get(slug))`, but
`NotePipeline._deleteNote` has already removed the note from `notes`, so this was
`undefined.slug`. `removeNote` now takes the slug directly, which is all it ever needed.

This was **masked by A9**: while `_deleteNote` was not awaited, its closing
`this.notes.delete(...)` landed after `GraphPipeline.on` had read the map, so the lookup still
succeeded. It only started firing once A9 was fixed.

### A4. The whole note's HTML is written into `__graph.json`

`graph_pipeline.js`, the `change` branch:

```js
for (const key of changedKeys) {
  this.nodes.get(slug)[key] = notes.get(slug)[key];
}
```

`changedKeys` almost always contains `content`, so the note's **entire rendered HTML** gets
copied onto the graph node — and `__graph.json` is loaded by every page. `toNode()` deliberately
keeps only `title`, `slug`, and `matter`; this loop bypasses it. Copy only the keys a node has.

Compounds with B1.

### A5. Every force strength is silently ignored

`graph_pipeline.js`, `computeForceSimulation`:

```js
if ('force' in settings) force = force.strength(settings.strength);
```

The key is `strength`, not `force`, so the condition is never true. All four tuned constants
(link `60`, repel `-20`, center `1000`, radial `0.001`) are inert and the layout you see is d3's
defaults. Expect the graph to change shape noticeably when this is fixed — retune afterwards.

### A6. Backlinks are never pruned, and neighbours are never re-saved

_Intended design, never finished — confirmed with the author._

Two halves of the same gap:

- `unify_pipelines.js`, `addLinks` only ever **adds** to the backlinks map. Removing a link from
  a note leaves a stale backlink on the target forever (until a full restart).
- `note_pipeline.js`, `on()` re-saves only the notes in `toSave` (the ones added or changed). The
  slugs accumulated in `diffs` — precisely the neighbours whose `backlinks` need refreshing — are
  never written out.

The `changeSets` / `diffs` machinery in `change()` exists _for this purpose_. It is computed,
threaded through to `GraphPipeline`, and then dropped on the floor. Finishing it means: prune
backlinks on change, and extend the save loop to cover `diffs.keys()`.

### A7. The watcher feeds non-Markdown files to the Markdown parser — **fixed**

`note_preprocessor.js` — `updateAll()` filtered on `path.extname(entry.name) == '.md'`, but
`watch()` did not filter at all. Saving an image into the note tree produced an `add` event that
`NotePipeline` handed straight to the rehype pipeline. In practice a PNG's bytes contain `$`, so
MathJax tried to parse them as TeX and threw from inside `mathjax-full`; the matching `unlink`
then reached `_deleteNote(undefined)`.

Fixed with a shared `isNote()` helper used by both `updateAll()` and the watcher's event
handler, plus a guard in `NotePipeline.on` that skips deletes for slugs it knows nothing about.

### A8. The static build can race the preprocessor — **fixed**

`note_preprocessor.js`, `flush_events` called `this.on(events)` without awaiting it, and was
itself not async. So `updateAll()` — and therefore `preprocess()` — resolved before any pipeline
had finished writing, and `index.js`'s `build()` could start vite before the notes existed.

Fixed together with A9: `flush_events` is `async` and awaits `on()`, and `updateAll()` awaits
`flush_events()`.

### A9. Saves and deletes escape the pipeline's completion — **fixed**

`note_pipeline.js`, `on()` called `this._saveNote(...)` and `this._deleteNote(...)` without
`await`. Both are async, so writes outlived the function and a rejection became an unhandled
rejection — which on Node ≥ 15 exits the process. Now collected into `writePromises` and awaited.

`flush_events` also wraps `on()` in a `try`/`catch` that logs, because the watcher calls it from
a timer: one bad note should cost that note, not the watcher.

### A10. `add()` and `change()` race within one debounce window — **fixed**

`note_pipeline.js`, `on()` started every `add` and every `change` promise in the same loop, before
awaiting either. A file created _and_ edited inside one 2s debounce window queued both events, and
`change()` read `oldNote['links']` before `on()` had computed it — `links` is only derived from
`linkSlugs` later, so this was `undefined.map`.

Fixed in `NotesUpdater._coalesceEvents`, which collapses a window's events down to one per path
(`unlink` beats everything, `add` beats `change`) — the same collapsing `watcher` does inside its
own 300ms window, which is why the gap has to exceed 300ms to reproduce. `NotePipeline.change`
additionally falls back to add-like behaviour for a slug it has never seen, tolerates an
un-enriched `oldNote`, and `on()` deduplicates `toSave` (two paths can still collide on one slug —
see A13).

### A11. Three CLI options silently ignore their arguments

`index.js` — commander options are declared with no value placeholder:

```js
.option("--log-level", "...", "debug")
.option("-p, --port", "...", 5173)
.option("--base-path", "...", ...)
```

Without `<value>` in the flag string, commander treats these as **booleans**. `--port 8080`
parses `8080` as a stray argument and the port stays at the default; same for `--base-path` and
`--log-level`. Add placeholders: `"-p, --port <port>"`. (`--only-notes` is correctly a boolean.)

Until this is fixed, use the `BASE_PATH` environment variable for sub-path builds.

### A12. Preprocessor paths are relative to CWD, not the package

`index.js` passes `'./src/lib/notes/'` and `'./static/note_imgs/'` to `preprocess()`. Vite is
correctly rooted at `__dirname`, but these are not — so the declared `bin: noteplot` entry point
writes notes into whatever directory the user happens to be standing in. Same problem in the
routes' `entries()`, which does `readdir('src/lib/notes')`.

Resolve both against `__dirname`. Blocks distributing this as an npm package at all.

### A13. `toSlug` collides on `-` versus `_`

`unify_pipelines.js`: the slug function replaces `-` with `_` and then path separators with `-`.
The comment says this keeps `dir/note.md` and `dir-note.md` distinct — and it does. But it
introduces a different collision: **`a-b.md` and `a_b.md` both become `a_b`**. Two notes, one
JSON file, one URL; the second silently overwrites the first.

### A14. Node positions drift on every edit

_Confirmed with the author: positions should be stable._

`graph_pipeline.js`, `updatePositions` re-runs the simulation over **all** nodes with none of
them pinned. On a full build that is `log(alphaMin) / log(1 - alphaDecay)` ≈ **69,000 ticks**
(with `alphaDecay: 0.0001`); on an incremental change it is 100 ticks, but every existing node
still moves.

Fix by setting `fx`/`fy` on nodes that already have a stored position and relaxing only the new
ones. That also makes the incremental path much cheaper, and makes the 69k-tick full run a
one-time cost rather than a per-startup one.

### A15. The initial scan does not honour the watcher's ignore rules

_Surfaced by fixing A0._

`note_preprocessor.js` — `updateAll()` walks the tree with `readdir` and filters on `.md` alone,
while `watch()` additionally skips any path with a dot-prefixed segment. So `notes/.hidden.md` is
indexed by the startup scan but its later edits are ignored, and a `.git` directory containing
`.md` files is picked up wholesale on launch.

Extract `watch()`'s `ignoreFn` and apply it in `updateAll()` too.

### A16. One bad frontmatter block took down the whole build — **fixed**

Not in the original analysis; found while checking B11. `unify_pipelines.js`, `addFrontmatter`
called `matter(file)` bare, and `vfile-matter` is unforgiving in two different ways:

- **It throws.** For an empty block (`---\n---`) it hands the YAML parser `undefined`
  (`TypeError: Cannot read properties of undefined (reading 'length')`); for malformed YAML it
  propagates the parse error. Either one rejected the whole pipeline run. Reproduced against a
  four-note collection where one note had `---\n---`: **nothing at all was written** — not the
  bad note, not the three good ones, not `__graph.json`, not `__search.json`. Since `build()`
  then runs vite regardless, that ships an empty site.
- **It returns `null`.** For a block that parses to nothing (a comment-only
  `---\n# note\n---`), `file.data.matter` is `null`, not `{}` — and that `null` is serialised
  into the note JSON and into `__graph.json`. Three consumers indexed straight into it:
  `NoteMetaContent`'s destructure, `generateGlow`'s `node.matter.tags`, and `search_index.js`'s
  `document.matter.tags`.

Fixed at the producer — `addFrontmatter` catches, warns with the file path, and normalises
`matter` to `{}` — plus optional chaining in all three consumers, since JSON from an earlier
build can still hold `null`.

### A17. A small collection produced a viewBox the frontend cannot use — **fixed**

Not in the original analysis. `graph_pipeline.js` emitted a degenerate `viewBox` in two cases,
each of which stopped the graph mounting at all:

- **No notes.** `nodesToUpdate.size > 0` is false, so `updatePositions` never ran and `viewBox`
  stayed at its initial `null`. `CanvasScreen`'s constructor then did `viewBox[0]` on `null` —
  `TypeError: Cannot read properties of null (reading '0')`.
- **One note**, or any collection whose nodes are collinear. `shrinkViewBox` computed
  `width = maxX - minX = 0`, giving `viewBox: [0, 0, 0, 0]`. `constructGrid` then has
  `gridSize = 0`, so `numRows` is `NaN` and `Array(NaN)` throws `RangeError: Invalid array
length`.

Both reproduced by building a zero-note and a one-note collection and feeding the resulting
`__graph.json` to the grid maths.

Fixed at the producer: `viewBox` initialises to `DEFAULT_VIEW_BOX` rather than `null`,
`shrinkViewBox` returns that default for an empty node list, and `width`/`height` are floored at
`MIN_VIEW_BOX_SIZE`. The consumer was hardened independently (see C8), so either half alone is
enough — which matters because `__graph.json` from an older build may still hold the bad values.

---

## B. Data flow

### B1. `__graph.json` embeds a full copy of every node, twice per link

`graph_pipeline.js`, `shrinkViewBox`'s `moveNode` returns **copies**, and links are then rebuilt
as `{source: copy, target: copy}`. The serialised file therefore contains roughly
`2 × (number of links)` complete node objects on top of the real `nodes` array — each carrying
`matter`, and (via A4) the note's entire HTML.

Confirmed against a scratch collection: with 3 notes and 4 links, `__graph.json` contains 3 real
nodes plus 8 embedded copies of them.

Each node also carries d3's `vx`/`vy` simulation velocities, which are meaningless once the
layout is frozen and should be stripped on the way out.

Serialise links as `{source: slug, target: slug}` and rehydrate them to node references in
`CanvasGraph`'s constructor, which already builds a `slug → node` map.

Also note the client-side consequence today: because link endpoints are copies rather than
references into `nodes`, moving a node would not move its links.

### B2. The entire corpus is inlined into the JS bundle

- `(graph)/+layout.js` statically imports `__graph.json` — every page.
- `search/+page.js` and `filter/+page.js` statically import `__search.json`, which is the **full
  plaintext of every note**.

Static JSON imports are inlined by Vite, so there is no lazy loading and no caching separate
from the bundle. At hundreds of notes this is the single biggest payload win available. Use a
dynamic `import()` inside `load`, or move the files to `static/` and `fetch` them.

Already a README TODO ("refactor loading of search index jsons").

### B3. The search index is rebuilt on every mount

`SearchWindow.svelte` and `FilterWindow.svelte` each do `new MiniSearchIndex(notes)` at component
scope — so the whole corpus is re-indexed every time the pane is opened. Hoist to a
module-level lazily-initialised singleton in `search_index.js`.

### B4. Queries race the index construction

`MiniSearchIndex`'s constructor kicks off `addAllAsync` and stores the promise as
`costructionPromise` (sic), exposed via `ready()`. **Neither window awaits it** before calling
`search()`. The first query after opening the pane can run against a partially built index and
silently return nothing or too little.

Either await `ready()`, or use the synchronous `addAll`.

### B5. The drag-to-resize handle never renders

`toolbar/DesktopToolbar.svelte`: `{#if $contentSlider.hasContent}`. `hasContent` lives on
`contentState`, not on the slider store, so the expression is always `undefined` and
`ResizeContent` is never mounted.

A textbook stringly-typed-context failure — see the context table in `src/lib/CLAUDE.md`.

### B6. Toolbar active-state ignores `base`

`toolbar/buttons/Search.svelte` and `Filter.svelte` compare
`$page.url.pathname == '/search'` against a base-less literal. On any sub-path deploy the
highlight never lights up. Compare against `` `${base}/search` ``. Missed by the "use base
paths" commit.

### B7. Two competing mechanisms for "show the note without the graph"

`withGraph` and `graphFullScreen` are returned by four `load` functions and **read nowhere**. The
intended `/(graph)/notes/[slug]` behaviour — note only, no graph, which matters on mobile — is
consequently unimplemented.

The complication is that a second, _working_ mechanism for the same concept already exists:
`contentState` with its `?onlyContent` / `?noContent` search params. Don't wire up `withGraph`
alongside it. Pick one: the smaller change is to delete both flags and have `/notes/[slug]` seed
`contentState` with `onlyContent`, so route and search param express the same state through one
code path.

### B8. `replaceState` fires on every content-state update

`content/WithContentState.svelte`: `if (newUrl != page.url)` compares two `URL` **objects** by
reference, which is always true. Compare `newUrl.href !== page.url.href`.

### B9. `graphState.activeNote` holds the entire note

`graph/WithGraphState.svelte` puts `pageData.note` — full rendered HTML included — into the
store, while every consumer reads only `.slug`. Store the slug, or a `{slug, title}` pair.

### B10. Duplicated route code

`[slug]/+page.js` and `notes/[slug]/+page.js` have byte-identical `load` bodies (modulo the dead
flags) and byte-identical `entries()`. The two `+page.svelte` files are identical too. Extract a
shared helper — the `entries()` duplication in particular means the A12 path fix has to be made
twice.

### B11. `NoteMetaContent` is non-reactive and timezone-dependent — **half fixed**

`note/NoteMetaContent.svelte`:

- ~~`const { tags, ...otherMatter } = matter` runs once at init, so it will not update if
  `matter` changes, and it **throws** if `matter` is not an object.~~ **Fixed:** the destructure
  is now reactive and defaults to `{}`. See A16 for where the bad `matter` came from.
- `new Date(readingTime.time).getMinutes()` reads a duration in milliseconds as a wall-clock
  time. In any timezone with a non-whole-hour offset (`+05:30`, `+09:30`, …) the minutes are
  wrong. Compute from the millisecond value directly. **Still open.**

### B12. Relative note links

`NoteMetaContent` renders `href={`./${link.slug}`}`. Relative resolution means the same link
points somewhere different from `/x` than from `/notes/x`, and it breaks under a base path. Use
`` `${base}/${link.slug}` ``.

### B13. `WithHoverableLinks` never cleans up

`note/WithHoverableLinks.svelte`:

- `unregisterEvents` calls `addEventListener` instead of `removeEventListener` — it adds a
  second listener rather than removing the first.
- It would not matter anyway: the cleanup closure is written as a bare `() => {...};` statement
  and **never returned** from `onMount`, so Svelte never calls it.

Currently harmless because `{#key}` in `Note.svelte` destroys the elements too, but it is a trap
for anyone who changes that.

---

## C. Rendering / visualisation

### C1. A full graph redraw on every mousemove over a node

`canvas_graph.js`: `graphStateStore.hover(node)` always allocates a new state object, so
`onGraphStateChange`'s `this.graphState !== newState` guard always passes and `draw()` runs.
`onHover` calls it on _every_ mousemove while the pointer is over any node.

Guard on the hovered slug actually changing, in `onHover` or in the store's `hover()`.

### C2. No `requestAnimationFrame` batching

Zoom, resize, `graphState`, `filterState`, and the dark-mode listener each call `draw()`
synchronously. Multiple redraws routinely land in a single frame (a zoom event that also changes
the hovered node, for instance).

Coalesce into one rAF-scheduled redraw. Together with C1 this is the largest interaction win
available, and it is a small change.

### C3. Glow colours are re-parsed per pixel, per node, per frame

`canvas_graph.js`, `drawNodeGlow` builds an `hsla(...)` string and runs
`d3.color(str)?.formatHex()` **inside the pixel loop** — 20 squares × N nodes × every frame,
each one a string format plus a CSS colour parse.

Precompute one colour string per tag in `generateGlow()` (two variants, light and dark). Pure
win, no behaviour change.

### C4. No viewport culling

Every node, every link, and — above `k > 2` — every label is drawn regardless of whether it is
on screen. At high zoom that is almost entirely wasted work. Cull against the paintBox; the
hit-test grid could serve double duty here.

### C5. Per-point transforms in JS

`toScreenPos` is called for every node and both endpoints of every link, every frame, doing four
multiplies and four adds each. Setting `ctx.setTransform` once and drawing in viewBox
coordinates hands the same work to the canvas implementation. Note this would also change how
line widths and font sizes must be specified.

### C6. The hit-test grid is 5×5 for the whole graph

`constructGrid` uses `cellSize = min(viewBox.width, viewBox.height) / 5` regardless of node
count, so each mousemove linearly scans on the order of N/25 nodes. Size cells to a target
occupancy (a handful of nodes each) instead of a fixed division.

### C7. Hit radius doubles on retina displays

`getNode` uses `eps = 10 * this.screen.dpr`, but it compares against `toScreenPos` output, which
is in **CSS pixels** (the context is already `scale(dpr)`-ed). Drop the `dpr` factor.

### C8. `fillGrid` has no bounds check — **fixed**

`getNode` carefully checked its row/col against `numRows`/`numCols`; `fillGrid` did not. A node
landing on the padded viewBox boundary could index past the array and throw during construction.

`fillGrid` now clamps through a `clampGridIdx` helper, while `getNode` keeps rejecting — the
asymmetry is deliberate and documented in `src/lib/graph/CLAUDE.md`: a node has to go somewhere,
a pointer outside the graph should hit nothing. See A17 for the far more reachable version of
this bug.

### C9. `onHover` throws on every mousemove in Firefox

`event.sourceCapabilities.firesTouchEvents` — `sourceCapabilities` is a non-standard Chrome
property and is `undefined` elsewhere, so this throws before doing anything. Use a `pointermove`
listener and check `event.pointerType !== 'mouse'`.

### C10. Cursor changes wipe every other inline body style

`document.body.style = "cursor: pointer;"` assigns to `cssText`, replacing the whole inline
style declaration. Use `document.body.style.cursor = 'pointer'`. Relevant because a future
scroll-lock would also want to write to `body.style`.

### C11. Filtering rebuilds everything, twice per query

`onFilterChange` rebuilds both filtered maps from scratch on **every** filter-store write, and
`FilterWindow` writes twice per query (`setQuery` then `setResults`) — so two full rebuilds and
two full redraws per keystroke. The existing `// TODO: If query changed, only then filter` marks
the spot. Either make it one store write, or skip the rebuild when `results` is unchanged.

### C12. Unbounded zoom-out

`CanvasScreen.addZoom` sets no `.scaleExtent()`. The removed SVG implementation had
`[1, maxZoomCoef]` with `maxZoomCoef = 15`; the constraint was lost in the port to canvas.

### C13. Roughly a third of the graph sits behind the content pane

The canvas sizes itself to `window.innerWidth`/`innerHeight` and draws full-screen, while
`ContentSlider` overlays the right ~38% (the golden-ratio default). Nodes under the pane are
drawn but permanently invisible, and centring is off by half the pane width.

This is the README's "graph shift with content slider" TODO. The fix belongs in `updatePaintBox`
— give `CanvasScreen` an inset and subscribe to the slider width — not in CSS, because the
hit-testing has to agree with what is drawn.

### C14. The glow pattern changes on every page load

`generateGlow` calls `Math.random()` (via `sample_normal`) at runtime, so a node's tag cloud is
laid out differently every time the page is opened. Seed the RNG, or move glow generation into
the preprocessor and serialise it — the same argument as for node positions in A14.

---

## D. Cleanup completed

The following unreferenced code was removed as part of this analysis, for the record:

- `src/lib/graph/Graph.svelte` and `src/lib/graph/GraphNode.svelte` — the SVG renderer superseded
  by `GraphCanvas`. (`GraphNode` also had a duplicated `on:mouseenter` where the second handler
  immediately unset `hover`.)
- `src/lib/ContentSwitcher.svelte` — unfinished, and containing a **literal syntax error**
  (an unterminated object literal). It only escaped the build because nothing imported it.
  Superseded by `content/WithContentState.svelte`.
- `src/lib/WithUrlStateContext.svelte` — superseded by `content/WithContentState.svelte`.
- `src/lib/stores/graphInterfaceState.js` and the now-empty `src/lib/stores/`.
- `src/lib/search/SearchMatchSpans.svelte` — no importers.
- `NoLibSearchIndex` and `FlexSearchIndex` from `src/lib/search/search_index.js`, plus the
  `flexsearch` dependency.
- Stale `getContext('graphInterfaceState')` calls — nothing has set that key for some time.

`src/lib/note/MobileNoteContainer.svelte` was **kept**: it is the natural home for the mobile
note view described in B7, even though its usage in `Note.svelte` is currently commented out.
