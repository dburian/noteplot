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

### A1. `isDeepEqual`'s array branch always returned `true` — **fixed**

`note_pipeline.js` — `new Array(a.length).every(...)` iterates a **sparse** array, and `.every`
skips holes, so the callback never ran.

Arrays were therefore never actually compared. Consequences:

- `images` never entered `diffKeys`, so **images removed from a note were never deleted** from
  `static/note_imgs/`.
- The object branch compares key _sets_ with `isDeepEqual(aKeys, bKeys)` — also arrays — so an
  added or removed frontmatter key went undetected. (Values were still compared, because the loop
  over `aKeys` runs regardless.)

Fixed with a plain `for` loop. A `null` guard was added above the object branch at the same time:
`typeof null == 'object'`, so `Object.getOwnPropertyNames(null)` throws, and a frontmatter key with
an empty value (`key:`) parses to `null`. That was reachable before this fix too, through the
value loop.

Fixing the comparison **unmasked a floating rejection** — the same shape as A9. `change()` pushed
`rm(imgPath)` into a `removePromises` array it never awaited; the array was always empty only
because this comparison never reported a difference. `change()` now awaits them, and every `rm` in
the pipeline passes `{force: true}`, so a file that is already gone cannot reject the batch. See
A19 for why that happens.

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

### A4. The whole note's HTML was written into `__graph.json` — **fixed**

`graph_pipeline.js`, the `change` branch:

```js
for (const key of changedKeys) {
  this.nodes.get(slug)[key] = notes.get(slug)[key];
}
```

`changedKeys` almost always contains `content`, so the note's **entire rendered HTML** was copied
onto the graph node — and `__graph.json` is loaded by every page. `toNode()` deliberately keeps only
`title`, `slug`, and `matter`; this loop bypassed it.

Fixed by copying only the keys the node actually has (`if (key in node)`), so `title` and `matter`
still update and everything else is skipped. `toNode` stays the single definition of a node's shape.

Compounded with B1, and was fixed alongside it.

### A5. Every force strength was silently ignored — **fixed**

`graph_pipeline.js`, `computeForceSimulation`:

```js
if ('force' in settings) force = force.strength(settings.strength);
```

The key is `strength`, not `force`, so the condition was never true. All four tuned constants (link
`60`, repel `-20`, center `1000`, radial `0.001`) were inert and the layout was d3's defaults.

**Fixing the key alone would have been worse than the bug.** `strength` on `forceLink`,
`forceCenter` and `forceRadial` is a per-tick multiplier, so a value above 1 overshoots and
amplifies. Measured against d3 directly, `link: 60` and `center: 1000` each drive the simulation to
`NaN` on their own within ~100 ticks — which would have written a `NaN` viewBox, and the graph would
not have mounted at all. (`forceManyBody`'s `-20` is a charge, not a multiplier, and is fine.)

So the two out-of-range constants came into range in the same commit — link and center strength `1`
— and a comment now records the `<= 1` rule for whoever retunes them next. On a 60-node/89-link
corpus at the full 69,075 ticks the layout tightens mildly and keeps its character: extent 108×114
against 131×137 before, median nearest-neighbour spacing 0.082 of graph width against 0.086. The
constants are now genuinely in effect, so they can be retuned by eye.

### A6. Backlinks are never pruned, and neighbours are never re-saved — **fixed**

_Intended design, never finished — confirmed with the author._

Two halves of the same gap:

- `unify_pipelines.js`, `addLinks` only ever **adds** to the backlinks map. Removing a link from
  a note leaves a stale backlink on the target forever (until a full restart).
- `note_pipeline.js`, `on()` re-saves only the notes in `toSave` (the ones added or changed). The
  slugs accumulated in `diffs` — precisely the neighbours whose `backlinks` need refreshing — are
  never written out.

The `changeSets` / `diffs` machinery in `change()` exists _for this purpose_. It was computed,
threaded through to `GraphPipeline`, and then dropped on the floor.

Finished in four pieces:

- `change()` prunes `oldSlugs \ newSlugs` from the backlinks map. `_rehype` has already inserted
  the new version's links by then, so old-minus-new is exactly the set nothing justifies any more.
- `_enrichNote(note)` replaces the inline enrichment in the save loop and is **idempotent** — a
  neighbour re-saved because of someone else's edit has already been enriched once. It reads its
  link slugs through a shared `_linkSlugsOf(note)` (`note.links ?? note.linkSlugs ?? []`), the same
  tolerance the A10 fix added to `change()`; `_deleteNote` uses it too, where an unguarded
  `note.links` would have thrown for a note deleted before its first successful save.
- The save loop iterates `toSave ∪ diffs.keys() ∪ resave`, skipping slugs no longer in
  `this.notes`. `resave` is a separate set of neighbours to rewrite, fed by deletes, by adds (whose
  sources were resolving to the `Unknown` placeholder) and by A20. It is kept **out** of `diffs`
  deliberately: `changes` means "what changed inside this note" to `GraphPipeline`, and a `links`
  entry there would re-lay the node for a neighbour's edit.
- Deletes moved **before** the save loop. They prune the backlinks map and drop the note from
  `this.notes`, and the save loop has to see both. `this.backlinks.get(deletedSlug)` is
  deliberately kept — it describes links that still exist in other notes.

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
un-enriched `oldNote`, and `on()` deduplicates `toSave` — which, since A13 made `toSlug` injective,
is a guard rather than a workaround.

### A11. Three CLI options silently ignored their arguments — **fixed**

`index.js` — commander options were declared with no value placeholder:

```js
.option("--log-level", "...", "debug")
.option("-p, --port", "...", 5173)
.option("--base-path", "...", ...)
```

Without `<value>` in the flag string, commander treats these as **booleans**. `--port 8080` parsed
`8080` as a stray argument and the port stayed at the default; same for `--base-path` and
`--log-level`. (`--only-notes` is correctly a boolean.)

Fixed by adding placeholders. `--port` also gained `parseInt` as an arg parser, since commander
hands over a string and the default was a number, and `--log-level` is now validated against pino's
levels — assigning an unknown one to `logger.level` throws.

Three neighbouring bugs went with it: `build`'s `.argument("<note-dir")` was missing its closing
`>`, `viteBuild(...)` was not awaited so `build()` resolved before vite finished, and the
`buildConfig.base` passed to vite was dead code — `base` and `root` are both in the SvelteKit vite
plugin's `enforced_config`, so vite's values are overridden and warned about. `process.env.BASE_PATH`,
which `svelte.config.js` reads, is the only channel that works; `root` is handled by the `chdir` in
A12.

### A12. Preprocessor paths were relative to CWD, not the package — **fixed**

`index.js` passed `'./src/lib/notes/'` and `'./static/note_imgs/'` to `preprocess()`, so the
declared `bin: noteplot` entry point wrote notes into whatever directory the user happened to be
standing in. The routes' `entries()` had the same problem — `readdir('src/lib/notes')`.

**Fixed for the preprocessor and for vite.** The two output paths now resolve against `__dirname`,
and `setupCommonOpts` resolves the note directory against the user's CWD and then calls
`process.chdir(__dirname)`.

The `chdir` is not laziness, it is the only available lever: SvelteKit's `load_config` resolves
`svelte.config.js` and every `kit.files.*` against `process.cwd()`
(`src/core/config/index.js`), and its vite plugin **enforces** `root: process.cwd()`, overriding
and warning about any `root` we pass to `createServer`/`viteBuild`. So `root: __dirname` was never
doing anything, and without the `chdir` a build from another directory could not find
`svelte.config.js` at all. Resolving the note directory *before* the `chdir` is what keeps a
relative `<note-dir>` meaning what the user typed.

The routes' half went with B10: `src/lib/notes_route.js` enumerates notes from
`import.meta.glob('$lib/notes/*.json')`, which Vite resolves against the package at build time, so
no route reads a directory at runtime.

### A13. `toSlug` collided on `-` versus `_` — **fixed**

`unify_pipelines.js`: the slug function replaced `-` with `_` and then path separators with `-`.
The comment said this keeps `dir/note.md` and `dir-note.md` distinct — and it did. But it
introduced a different collision: **`a-b.md` and `a_b.md` both became `a_b`**. Two notes, one
JSON file, one URL; the second silently overwrote the first.

Fixed by escaping the delimiter instead of destroying it — `~` → `~~`, then `-` → `~-`, then
`path.sep` → `-`, with `_` left untouched so the common case (`math/taylor_series.md` →
`math-taylor_series`) is unchanged. `~` is escaped first so the `~` the second pass introduces is
not escaped again.

The obvious cheaper scheme — double the delimiter, `-` → `--` — was **rejected because it is not
injective**. Doubling is ambiguous at component boundaries: `d-/x.md` gives `d--` + `-` + `x` and
`d/-x.md` gives `d` + `-` + `--x`, both `d---x`. With an escape character there is no ambiguity:
`~` always starts a two-character token and a lone `-` is always a separator, so no two source
paths can share a slug.

Slugs are therefore **opaque** — never split one on `-` to recover a path.

Existing URLs for any note with a `-` or `~` in its name changed. `src/lib/notes/` and
`static/note_imgs/` had to be wiped once: nothing prunes a file whose slug no longer exists, and a
stale `<old-slug>.json` is still picked up by `entries()` and prerendered.

### A14. Node positions drifted on every edit — **fixed**

_Confirmed with the author: positions should be stable within a session, and a restart should re-lay
the graph from scratch._

`graph_pipeline.js`, `updatePositions` re-ran the simulation over **all** nodes with none of them
pinned. On a full build that is `log(alphaMin) / log(1 - alphaDecay)` ≈ **69,000 ticks** (with
`alphaDecay: 0.0001`); on an incremental change it is 100 ticks, but every existing node still
moved.

Fixed in `genD3Format`: a node that already has an entry in `this.positions` is emitted with
`fx`/`fy` as well as `x`/`y`, so d3 holds it in place and only new nodes relax. The pins are
stripped on the way out (see B1) and never reach the frontend.

Positions are deliberately **not persisted**. `this.positions` only ever lives in memory, so on a
fresh process nothing is pinned and the full ~69k-tick relaxation runs exactly as before; only
within a running watch session does the graph stay put. The branch choosing between the full and
the 100-tick run therefore now tests `nodesWithoutPosition` rather than `positionsToUpdate`: the
two are identical on a cold start, but the old test would have spent the full 69k ticks on an
entirely pinned graph whenever every note changed at once in a live session.

`removeNote` also drops the slug from `this.positions`, so the map cannot grow for the lifetime of
the session. The trade-off is that deleting a note and re-adding it relaxes it as a new node instead
of returning it to where it was.

What pinning does **not** buy: `this.positions` stores coordinates *after* `shrinkViewBox`'s
translation, so a new node landing left of or above the existing extent still shifts every node by
the same amount. Nodes do not move relative to each other, which is what stability means here.

### A15. The initial scan did not honour the watcher's ignore rules — **fixed**

_Surfaced by fixing A0._

`note_preprocessor.js` — `updateAll()` walked the tree with `readdir` and filtered on `.md` alone,
while `watch()` additionally skipped any path with a dot-prefixed segment. So `notes/.hidden.md`
was indexed by the startup scan but its later edits ignored, and a `.git` directory containing
`.md` files was picked up wholesale on launch.

Fixed by extracting `watch()`'s `ignoreFn` into `NotesUpdater._isIgnored`, which is now both
`watcher`'s `ignore` predicate and a filter in `updateAll()`. `updateAll()` tests the **joined**
path rather than `entry.name`, so a note inside a hidden directory is caught too.

`readdir` still descends into `.git`; `recursive: true` offers no way to prune a directory, so this
filters the walk rather than avoiding it. The three-path-shapes comment from A0 moved with the
predicate — it still applies, because `watcher` is still the caller that supplies the awkward
shapes.

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

### A18. `build` failed outright on a note collection with no notes — **fixed**

Found while verifying A17, and **pre-existing** — reproduced at commit `5148242`, before any of
these fixes. With zero notes, the routes' `entries()` returns an empty array, and SvelteKit
refused the build:

```
Error: The following routes were marked as prerenderable, but were not prerendered
because they were not found while crawling your app:
  - /(graph)/notes/[slug]
  - /(graph)/[slug]
```

Resolved by **failing fast** rather than teaching the build to tolerate zero notes: `preprocess()`
now returns the note count, and `index.js`'s `build()` logs `No Markdown files found under
<note-dir> — nothing to build.`, sets a non-zero exit code, and returns before calling vite.

The alternative — `prerender = 'auto'` on the two `[slug]` routes — was rejected: this is a static
site with `strict: true`, so a build that produces no note pages is a mistake worth reporting, and
weakening the prerender guarantee to make that mistake quiet would cost the one check that catches
an unprerenderable route.

`watch` only warns, since notes may appear later, and the watcher picks them up.

Note that the pipelines have already run by the time the count is known, so a build pointed at the
wrong directory still overwrites `__graph.json` and `__search.json` with empty ones. The
per-note JSON of the previous collection survives, because nothing prunes it (see A13).

### A19. Two notes embedding the same image fight over one file

_Surfaced by fixing A1, which is what made the removal path run at all._

`unify_pipelines.js`, `collectImgs` derives an image's destination from the **image's own** path
(`toSlug(absolutePath, noteRoot, {withExtension: true})`), so `img.png` referenced by two notes is
copied to one file in `static/note_imgs/` and appears in **both** notes' `images` arrays.

Deleting either note, or editing either note to drop the image, therefore removes the file the
other note still points at — a broken image with no error anywhere. The remaining note only gets
it back when it is next re-parsed.

`{force: true}` on the `rm` calls (see A1) keeps this from crashing the pipeline, which is all that
has been done. A real fix needs per-image reference counting in `NotePipeline` — an
`image → Set<slug>` map alongside `backlinks`, with the `rm` deferred until the last referrer drops
it. The same map would let a restart notice orphaned images, which nothing currently prunes.

### A20. Every neighbour caches a note's title — **fixed**

_Found while fixing A6, which is what made re-saving a neighbour possible at all._

`note_pipeline.js`, `_enrichLinks` resolves a link slug to `{slug, title}` — a **snapshot** of the
target's title, written into the source's `links` and into the target's `backlinks`. Nothing
refreshed it, so renaming a note's first heading left every note on either side of every one of its
edges displaying the old title until the next restart. The same "correct only because a restart
rebuilds everything" failure as A6.

`change()` already diffs `title`. When that key is in `diffKeys` the note's backlink sources (whose
`links` name it) and its link targets (whose `backlinks` name it) go into A6's `resave` set, so both
directions are rewritten in the same batch.

---

## B. Data flow

### B1. `__graph.json` embedded a full copy of every node, twice per link — **fixed**

`graph_pipeline.js`, `shrinkViewBox`'s `moveNode` returned **copies**, and links were then rebuilt
as `{source: copy, target: copy}`. The serialised file therefore contained roughly
`2 × (number of links)` complete node objects on top of the real `nodes` array — each carrying
`matter`, and (via A4) the note's entire HTML. Each node also carried d3's `vx`/`vy` velocities,
meaningless once the layout is frozen.

Confirmed against a scratch collection: with 3 notes and 4 links, `__graph.json` contained 3 real
nodes plus 8 embedded copies of them.

Fixed on both sides:

- **Producer.** `shrinkViewBox` now translates nodes **in place** — they are rebuilt by
  `genD3Format` on every run, and the links already point at those same objects — and `on()`
  serialises links as `{source: slug, target: slug}` and nodes through `toSerialisableNode`, which
  drops `index`, `vx`/`vy`, and A14's `fx`/`fy`. That is a blocklist of what the simulation adds, so
  `toNode` stays the single definition of a node's shape.
- **Consumer.** `CanvasGraph`'s constructor already builds the `slug → node` map before the link
  loop, so each endpoint resolves through it. It accepts **both** shapes: a `__graph.json` from an
  older build still holds embedded node objects, and rejecting it outright would be fatal — the same
  reasoning as the A17 fix.

This also fixes the latent client-side bug noted here before: link endpoints are now real references
into `nodes`, so a node and its links cannot disagree.

Measured on a 7-note, 2-link scratch collection: 2010 bytes → 843. The saving grows with both link
count and note size.

### B2. The entire corpus is inlined into the JS bundle — **fixed**

`(graph)/+layout.js` statically imported `__graph.json` on every page, and `search/+page.js` /
`filter/+page.js` statically imported `__search.json`, the **full plaintext of every note**. Static
JSON imports are inlined by Vite, so there was no lazy loading and no caching separate from the
bundle.

All three are now `await import(...)` **inside `load`**, which Vite emits as its own chunk.
Prerendering is unaffected — `load` runs at build time and in the browser either way — and
`__search.json` now ships only to visitors who open search or filter.

Closes the README TODO ("refactor loading of search index jsons").

### B3. The search index is rebuilt on every mount — **fixed**

`SearchWindow.svelte` and `FilterWindow.svelte` each did `new MiniSearchIndex(notes)` at component
scope, so the whole corpus was re-indexed every time either pane opened.

`search_index.js` now exports `getSearchIndex(notes)`, which memoises one instance on the `notes`
reference and hands the same index to both windows. The reference is stable because both routes pass
the `__search.json` module array straight through — a spread anywhere along that path silently
reintroduces the re-indexing.

### B4. Queries race the index construction — **fixed**

`MiniSearchIndex`'s constructor kicks off `addAllAsync` and stores the promise as
`costructionPromise` (sic), exposed via `ready()`. Neither window awaited it before calling
`search()`, so the first query after opening a pane could run against a partially built index and
silently return nothing.

Both `searchIndex` functions are now `async` and `await index.ready()` first. `addAllAsync` is kept
deliberately — indexing off the main thread beats a synchronous `addAll` that would freeze the pane
— and each window's existing `searching` flag now drives a "searching ..." branch for the wait.

### B5. The drag-to-resize handle never renders — **fixed**

`toolbar/DesktopToolbar.svelte` guarded on `{#if $contentSlider.hasContent}`, but `hasContent` lives
on `contentState`, not on the slider store, so the expression was always `undefined` and
`ResizeContent` never mounted. A textbook stringly-typed-context failure — see the context table in
`src/lib/CLAUDE.md`.

`DesktopToolbar` now gets `contentState` from context (the slider store was fetched for nothing
else) and guards on that. `ResizeContent` itself still uses `contentSliderState`, which is correct:
it sets the width.

### B6. Toolbar active-state ignores `base` — **fixed**

`toolbar/buttons/Search.svelte` and `Filter.svelte` compared `$page.url.pathname` against the
base-less literals `'/search'` / `'/filter'`, so on a sub-path deploy the highlight never lit up.
Missed by the "use base paths" commit; both now compare against `` `${base}/search` `` /
`` `${base}/filter` ``, which is what their own `goto` already built.

### B7. Two competing mechanisms for "show the note without the graph"

`withGraph` and `graphFullScreen` are returned by four `load` functions and **read nowhere**. The
intended `/(graph)/notes/[slug]` behaviour — note only, no graph, which matters on mobile — is
consequently unimplemented.

The complication is that a second, _working_ mechanism for the same concept already exists:
`contentState` with its `?onlyContent` / `?noContent` search params. Don't wire up `withGraph`
alongside it. Pick one: the smaller change is to delete both flags and have `/notes/[slug]` seed
`contentState` with `onlyContent`, so route and search param express the same state through one
code path.

**Left open deliberately.** Which of the two mechanisms wins is a design call, not a bug fix, so the
B-series pass around it (B2–B13) left both flags exactly where they were.

### B8. `replaceState` fires on every content-state update — **fixed**

`content/WithContentState.svelte` did `if (newUrl != page.url)`, comparing two `URL` **objects** by
reference, which is always true. Now `newUrl.href !== page.url.href`, so the history entry is only
rewritten when the URL actually changed.

### B9. `graphState.activeNote` holds the entire note — **fixed**

`graph/WithGraphState.svelte` put `pageData.note` — full rendered HTML included — into the store,
while every consumer reads only `.slug`. A `toNoteRef` helper now narrows it to `{slug, title}` in
both the initialiser and the `$page.data.note` reactive block, and `canvas_graph.js`'s `GraphState`
typedef describes both notes as that `NoteRef` shape rather than a full search-index `Note`.

### B10. Duplicated route code — **fixed**

`[slug]/+page.js` and `notes/[slug]/+page.js` had byte-identical `load` bodies (modulo the dead
flags) and byte-identical `entries()`, so the A12 path fix would have had to be made twice.

Both now call `loadNote` / `noteEntries` from `src/lib/notes_route.js` and keep only their own
`withGraph` / `graphFullScreen` return values, which are still dead — that is B7, deliberately
untouched.

The two `+page.svelte` files stay separate: SvelteKit requires one per route. They are byte-identical
and each is a single `<NoteContent {...data.note} />`, so there is nothing left to share.

### B11. `NoteMetaContent` is non-reactive and timezone-dependent — **fixed**

`note/NoteMetaContent.svelte`:

- ~~`const { tags, ...otherMatter } = matter` runs once at init, so it will not update if
  `matter` changes, and it **throws** if `matter` is not an object.~~ **Fixed:** the destructure
  is now reactive and defaults to `{}`. See A16 for where the bad `matter` came from.
- ~~`new Date(readingTime.time).getMinutes()` reads a duration in milliseconds as a wall-clock
  time. In any timezone with a non-whole-hour offset (`+05:30`, `+09:30`, …) the minutes are
  wrong.~~ **Fixed:** computed from the millisecond value — `Math.floor(time / 60000)` and
  `Math.round((time % 60000) / 1000)` — and reactive, like the `matter` destructure above it.

### B12. Relative note links — **fixed**

`NoteMetaContent` rendered `href={`./${link.slug}`}` for both references and backlinks. Relative
resolution meant the same link pointed somewhere different from `/x` than from `/notes/x`, and it
broke under a base path. Both are now `` `${base}/${link.slug}` ``.

### B13. `WithHoverableLinks` never cleans up — **fixed**

`note/WithHoverableLinks.svelte` had two independent faults: `unregisterEvents` called
`addEventListener` instead of `removeEventListener`, so it added a second listener rather than
removing the first; and it would not have mattered, because the cleanup closure was a bare
`() => {...};` statement **never returned** from `onMount`.

Both fixed — `removeEventListener`, and the closure is returned. It was harmless while `{#key}` in
`Note.svelte` destroys the elements anyway, but it was a trap for anyone who changes that.

---

## C. Rendering / visualisation

### C1. A full graph redraw on every mousemove over a node — **fixed**

`canvas_graph.js`: `graphStateStore.hover(node)` always allocated a new state object, so
`onGraphStateChange`'s `this.graphState !== newState` guard always passed and `draw()` ran.
`onHover` calls it on _every_ mousemove while the pointer is over any node.

`hover()` in `WithGraphState.svelte` now returns the state object **unchanged** when the incoming
slug equals `values.hoveredNote?.slug`, so `update` writes the same reference and no subscriber
fires at all. Guarding in the store rather than in `onHover` keeps every consumer of `graphState`
— not just the canvas — off the redundant update.

### C2. No `requestAnimationFrame` batching — **fixed**

Zoom, resize, `graphState`, `filterState`, and the dark-mode listener each called `draw()`
synchronously. Multiple redraws routinely landed in a single frame (a zoom event that also changes
the hovered node, for instance).

The painting code is now `drawNow()`, and `draw()` is a scheduler: it holds one `pendingFrame` id
and requests an animation frame, so any number of requests within a frame collapse into one paint.
`destruct()` cancels a pending frame, and `deferDraw` keeps its old meaning of suppressing drawing
during construction. Every existing caller kept calling `draw()`; nothing needs a synchronous
paint.

### C3. Glow colours are re-parsed per pixel, per node, per frame — **fixed**

`canvas_graph.js`, `drawNodeGlow` built an `hsla(...)` string and ran
`d3.color(str)?.formatHex()` **inside the pixel loop** — 20 squares × N nodes × every frame,
each one a string format plus a CSS colour parse.

`generateGlow()` now resolves each tag's hue once into `{light, dark}` hex strings (the saturation
differs, 30% against 50%), and `drawNodeGlow` picks the variant once per node and indexes the map.
The glow data is `{pixels, colors}` where it used to be `{pixels, hues}`. `formatHex()` is kept
even though it drops the `0.4` alpha — the glow is already opaque on screen, and keeping that makes
this a pure performance change.

### C4. No viewport culling

Every node, every link, and — above `k > 2` — every label is drawn regardless of whether it is
on screen. At high zoom that is almost entirely wasted work. Cull against the paintBox; the
hit-test grid could serve double duty here.

**Left open deliberately.** The C-series pass fixed the per-frame waste that costs nothing to fix
(C1, C2, C3); culling changes what the renderer iterates and wants measuring against a real
collection first, so it was not attempted blind.

### C5. Per-point transforms in JS

`toScreenPos` is called for every node and both endpoints of every link, every frame, doing four
multiplies and four adds each. Setting `ctx.setTransform` once and drawing in viewBox
coordinates hands the same work to the canvas implementation. Note this would also change how
line widths and font sizes must be specified.

**Left open deliberately.** Every node width, line width and font size in `GraphRenderer` is
currently in CSS pixels; moving the transform into the context rescales all of them at once, which
is a rewrite of the renderer rather than an optimisation of it.

### C6. The hit-test grid is 5×5 for the whole graph — **fixed**

`constructGrid` used `cellSize = min(viewBox.width, viewBox.height) / 5` regardless of node
count, so each mousemove linearly scanned on the order of N/25 nodes.

`cellSize` is now `sqrt(viewBox.width * viewBox.height / ceil(N / 4))` — sized by node count, for
about four nodes per cell whatever the collection's size. The `|| 1` on `cellSize` and the
`Math.max(..., 1)` on the row and column counts that the A17 fix added are kept: they are what
stops a zero-sized viewBox producing `Array(NaN)`.

### C7. Hit radius doubles on retina displays — **fixed**

`getNode` used `eps = 10 * this.screen.dpr`, but it compares against `toScreenPos` output, which
is in **CSS pixels** (the context is already `scale(dpr)`-ed), so the hit radius was twice as large
as intended on any retina display. `eps` is now a plain `10`.

### C8. `fillGrid` has no bounds check — **fixed**

`getNode` carefully checked its row/col against `numRows`/`numCols`; `fillGrid` did not. A node
landing on the padded viewBox boundary could index past the array and throw during construction.

`fillGrid` now clamps through a `clampGridIdx` helper, while `getNode` keeps rejecting — the
asymmetry is deliberate and documented in `src/lib/graph/CLAUDE.md`: a node has to go somewhere,
a pointer outside the graph should hit nothing. See A17 for the far more reachable version of
this bug.

### C9. `onHover` throws on every mousemove in Firefox — **fixed**

`event.sourceCapabilities.firesTouchEvents` — `sourceCapabilities` is a non-standard Chrome
property and is `undefined` elsewhere, so this threw before doing anything and hover highlighting
simply did not exist outside Chrome.

Now a `pointermove` listener (registered _and_ removed under that name) guarded on the standard
`event.pointerType !== 'mouse'`, which keeps the original intent of suppressing hover on touch.

### C10. Cursor changes wipe every other inline body style — **fixed**

`document.body.style = "cursor: pointer;"` assigns to `cssText`, replacing the whole inline
style declaration. `onHover` now writes `document.body.style.cursor` instead. Relevant because a
future scroll-lock would also want to write to `body.style`.

### C11. Filtering rebuilds everything, twice per query — **fixed**

`onFilterChange` rebuilt both filtered maps from scratch on **every** filter-store write, and
`FilterWindow` wrote twice per query (`setQuery` then `setResults`) — so two full rebuilds and
two full redraws per keystroke. The `// TODO: If query changed, only then filter` marked the spot.

Both halves are done. `WithFilterContext` exposes a single `setQueryAndResults(query, results)`
and no longer exposes `setQuery` / `setResults`, which had no other callers and only offered a way
back into the two-write pattern. `onFilterChange` records the `results` reference the maps were
built from and returns early when the new one is identical — the store's other field, `query`, is
not drawn, so such a write cannot change the picture.

### C12. Unbounded zoom-out — **fixed**

`CanvasScreen.addZoom` set no `.scaleExtent()`. The removed SVG implementation had
`[1, maxZoomCoef]` with `maxZoomCoef = 15`; the constraint was lost in the port to canvas and is
restored as `.scaleExtent([1, 15])`. `k = 1` is the fit-to-window scale — `updatePaintBox` already
letterboxes the whole viewBox into the canvas — so nothing is reachable below it.

### C13. Roughly a third of the graph sits behind the content pane

The canvas sizes itself to `window.innerWidth`/`innerHeight` and draws full-screen, while
`ContentSlider` overlays the right ~38% (the golden-ratio default). Nodes under the pane are
drawn but permanently invisible, and centring is off by half the pane width.

This is the README's "graph shift with content slider" TODO. The fix belongs in `updatePaintBox`
— give `CanvasScreen` an inset and subscribe to the slider width — not in CSS, because the
hit-testing has to agree with what is drawn.

**Left open deliberately.** It is a layout change, not a rendering bug: `CanvasScreen` would have
to subscribe to `contentSliderState`, which is the state it is currently and deliberately
independent of. Worth its own pass.

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
