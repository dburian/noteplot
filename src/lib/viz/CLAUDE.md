# `src/lib/viz` — the visualization registry and the force graph

> **Keep this file current.** Two parts of it are load-bearing: the registry contract, which is
> the only description of what a visualization has to provide, and the coordinate-space section,
> which is the hardest thing in this repo to reconstruct by reading. If you change either, update
> this file in the same commit.

```
src/lib/viz/
  registry.js                 the enumeration; `visualizations` and `getVisualization(id)`
  VizPane.svelte              the host: picks a descriptor, renders its View, supplies callbacks
  data.js                     getVizData(dataId): the lazy, memoised generated/viz/*.json loader
  CLAUDE.md                   this file
  force_graph/
    index.js                  the Visualization descriptor — the only export the registry uses
    ForceGraphView.svelte     a <canvas> + onMount → new CanvasGraph(...)
    ForceGraphControls.svelte the two toolbar toggles, for whichever graph is active
    canvas_graph.js           the renderer: three classes, no Svelte
  tag_graph/
    index.js                  descriptor only: the force graph's View over viz/tags.json
  date_graph/
    index.js                  descriptor only: the force graph's View over viz/dates.json
```

## The registry contract

A visualization is one descriptor in `registry.js`'s `visualizations` array:

| Field             | Meaning                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `id`              | stable; the `viz.settings` key and what is persisted to `localStorage` |
| `label`           | shown in the toolbar switcher, and titles its "Show <label>" command   |
| `dataId`          | which `src/lib/generated/viz/<dataId>.json` `View` gets as `data`      |
| `View`            | Svelte component, props `{data, settings, callbacks}`                  |
| `Controls`        | Svelte component rendered into the toolbar, no props; may be `null`    |
| `defaultSettings` | the **only** definition of this visualization's defaults               |

Adding a visualization is writing a directory next to `force_graph/` and pushing its descriptor
into that array. If it needs generated data, add a graph emitter in `preprocessor/emitters/` whose
`id` is the descriptor's `dataId` — see "Half 1" in the root `CLAUDE.md`. `tag_graph/` is the
smallest example: a descriptor reusing the force graph's `View` and `Controls` over `viz/tags.json`. Nothing in the shell, the toolbar or the state layer names a
visualization — `VizSwitcher` enumerates the registry, `VizSection` renders `active.Controls`, and
`VizPane` renders `active.View`.

Three rules hold that decoupling up:

- **`getVisualization(id)` falls back to the first entry**, never `undefined`. `viz.activeId` comes
  back from `localStorage`, which outlives any rename, and every caller reads `.label` or `.View`
  off the result immediately.
- **The state layer does not import this file.** `(app)/+layout.svelte` passes `visualizations`
  into `WithAppState`'s `vizDescriptors`, which is how `createVizState` learns each
  `defaultSettings` without `state/` depending on `viz/`. There is deliberately no second copy of
  those defaults — `state/viz.js` merges the stored blob **per key** over them, so a setting added
  after a user's blob was written still gets its default.
- **`Controls` may be `null`** and `VizSection` guards on it. A visualization with no toolbar
  controls is legal.

## `VizPane.svelte`

Loads the active descriptor's data with `getVizData(active.dataId)` from `data.js` — a lazy
`import.meta.glob` over `generated/viz/*.json`, so each graph is its own chunk and only the one on
screen is fetched. `AppShell` stays a pure layout component with nothing to forward.

`getVizData` returns **the same reference per id** — the promise, then the value — for the same
reason `getNote` does: `VizPane` renders inside an `{#await}`, which tears its then-branch down on
every new promise, and here that would rebuild `CanvasGraph` and lose the zoom.

The view is wrapped in **`{#key active.id}`**. `<svelte:component>` remounts only when `this`
changes, and the link, tag and date graphs share `ForceGraphView` — without the key, switching between
them would keep the old `CanvasGraph`, which has no update path from props, drawing the old graph.

It supplies `callbacks`, which is the whole of what a visualization may do to the app:

```
{ onActivate(slug), onHover(node) }
```

`onActivate` is `openNote(tiles, layout, slug)`, **only for slugs in `NOTES_INDEX`**: a graph may
hold nodes that are not notes (the tag graph's `tag/<name>` nodes), and opening one would put a 404
into a column. Otherwise it is the tile mutation and the layout reveal, as
every navigation source must be, and _not_ a `goto`: the path follows the focused tile from one
block in `WithAppState` (see `src/lib/CLAUDE.md`). The `layout` argument is what makes a node click
work in `viz` mode at all — the content pane is hidden there, so without it the note would open
into a `display: none` column and the click would look like it did nothing. `onHover` is
`selection.hover(toNoteRef(node))`.
Both live here rather than in the renderer for the same reason: **which tile a click opens into, and
what shape goes into the store, are the app's business, not the renderer's.** `toNoteRef` matters —
a graph `Node` carries `x`, `y` and `matter`, and putting that in `selection` is `ISSUES.md` B9.

`callbacks` is a `const`, not a reactive value. `CanvasGraph` captures it once at mount and a
rebuilt object would leave it holding a stale copy.

**Swapping visualizations is destroy-and-recreate.** `<svelte:component>` remounts on change, which
is the right semantics: `CanvasGraph` is built once in `onMount` and has no update path from props.
That is why `destruct()` has to be complete — see below.

**`AppShell` hides this pane in `content` mode, it does not unmount it** — `display:none`, never
`{#if}`. Unmounting remounted `<svelte:component>`, which rebuilt `CanvasGraph` from scratch, so
cycling the layout through `content` and back threw away the user's zoom and pan. A hidden canvas
measures `0 x 0`, which is safe: the graph is letterboxed into the body row rather than into the
canvas (see the coordinate spaces below), so the mapping survives the round trip untouched, and the
`ResizeObserver` fires again with the real size when the pane returns.

## `force_graph/`

### Why this is not Svelte components

The graph renders hundreds of nodes and redraws on every zoom, hover, and filter change. It is
therefore **imperative canvas code in plain `.js`**, not components. The Svelte side is only a
mount point.

```
ForceGraphView.svelte   a <canvas> + onMount → new CanvasGraph({...}) → teardown calls destruct()
```

`ForceGraphView` reads `SELECTION` and `FILTER` from context and hands the **stores** to
`CanvasGraph`, which subscribes to them directly. Svelte reactivity stops at that boundary: nothing
below re-runs when props change. `CanvasGraph` is built **once, in `onMount`**, from whatever
`data` it was given, and changing that prop later has no effect. Fine today — the graph data is
static per build — but it is the constraint to know before making the graph dynamic.

`settings` is the one prop that has to keep flowing, because toggling "Connections" in the toolbar
has to reach a graph that was built minutes ago. `ForceGraphView` bridges it: a
`writable(settings)` that a `$:` keeps in step, handed to `CanvasGraph` as a store like the other
two. Do not "simplify" it back to a value prop.

**The canvas is `absolute inset-0` inside a `relative` box, and its CSS size is never written from
JS.** `CanvasScreen` measures the element and resizes only the backing store; if it also set
`canvas.style.width`, the `ResizeObserver` below would be observing its own output.

`Graph.svelte` / `GraphNode.svelte` were an earlier SVG implementation. They have been removed; if
you find references, they are stale.

### The three coordinate spaces

Every position passes through three spaces, and `CanvasScreen` owns all conversions between them.

**1. viewBox space** — layout coordinates produced by the preprocessor's graph emitters
(`preprocessor/emitters/graph/`). Node `x`/`y` come
straight from the d3 force simulation, translated so the bounding box starts at the origin, with
10% padding added around it. **The date graph is not translated.** Its layout sets
`translate: false`, so x is absolute: `ms / timeAxis.msPerUnit`, with the epoch at 0. Its viewBox
therefore starts far from the origin, which `toScreenPos`/`toViewBoxPos` and the hit-test grid
handle already, since all of them subtract `viewBox.minX/minY`. A graph file's `viewBox` is `[minX, minY, width, height]`, mirroring
the SVG attribute it is named after. Nothing about this space depends on the browser.

`width` and `height` are always positive: `graph/layout.js`'s `fitViewBox` floors both at `MIN_VIEW_BOX_SIZE`
and emits a default box for an empty collection. The frontend divides by them and sizes the
hit-test grid from them, so a zero would be fatal — see `ISSUES.md` A17.

This space is **stable across runs**. `define_graph.js` persists every graph's positions in the
preprocessor cache (per note root) and pins every node that has one (`fx`/`fy`), so only new nodes
relax; the pins are stripped before serialising, which is why nothing in the graph file mentions
them. A full re-layout happens only when no node has a position — the first run, or after
`.cache/` is deleted (`ISSUES.md` A14). The one caveat: a new node landing left of or above the existing extent shifts every coordinate by
the same amount, because the bounding box is always re-originated. Nodes never move _relative to
each other_. The date graph has neither caveat. It is never re-originated, and its x is
pinned by the emitter to each note's date rather than taken from the cache, so changing a note's
date moves that one node and nothing else.

**2. paintBox space** — CSS pixels. The viewBox is letterboxed into the **frame** while preserving
aspect ratio, so `paintBox` is `{minX, minY, width, height}` describing where the graph actually
sits. Whichever axis is relatively tighter gets the full extent, the other is centred.

**The frame is the body row, not the canvas.** `CanvasScreen` finds it itself —
`canvas.closest('[data-viz-frame]')`, the attribute `AppShell` puts on the row that holds both
panes, falling back to the canvas when there is none — and `updateFrameBox()` measures it together
with the canvas's offset inside it, which is what keeps `paintBox` in canvas coordinates.

**That is what makes every coordinate independent of the layout mode**, and it is the whole reason
the frame exists. The canvas is ~38% narrower in `split` than in `viz` and `0 x 0` in `content`,
while the row is the same box in all three. Letterboxing into the canvas therefore changed the
scale, changed the centring offset, and could flip which axis was letterboxed — under a d3
transform that nothing adjusts — so the graph jumped every time the content pane opened or closed,
amplified by `k` and anchored at the canvas's top-left corner. Worst of all on the click that
_caused_ it: `onActivate` → `openNote` → `layout.reveal()` narrows the pane, so clicking a node in
`viz` mode moved the graph out from under the cursor. Dragging the divider did it continuously.

The consequence is deliberate and is the accepted cost: in `split` mode the graph runs **past the
canvas's right edge**, so part of it sits behind the content pane and reaching it is a pan. `k = 1`
now means "the whole graph fitted to the whole row", which is why `scaleExtent([1, 15])` cannot zoom
out to fit the narrow pane and is not supposed to. This reverses the reasoning of `ISSUES.md` C13
("roughly a third of the graph sits behind the content pane"), which is now the intended behaviour
— **do not "fix" it back.** It is also not a return of C13's mechanism: `insetRight`,
`setInsetRight` and the `contentSliderState.pixelWidth` chain that fed them stay gone. Nothing tells
the renderer how much of it is covered; it measures the row it sits in, and the culling below drops
whatever falls outside the canvas.

`updateCanvasSize()` reads `canvas.getBoundingClientRect()`, not `window.innerWidth/innerHeight`,
and both boxes are watched by one **`ResizeObserver`** rather than a `window` `resize` listener —
neither is a `window`-sized element and most of what resizes them is not a `resize` event. They are
watched for different things:

- the **canvas** sizes the backing store and bounds the culling. It changes with the window, the
  divider, and the layout mode, and none of that touches `paintBox` any more.
- the **frame** fixes `paintBox`, and changes only when the window (or the toolbar's height) does.
  A window resize does still re-letterbox the graph — that is the one place re-fitting is wanted.

Four guards inside that, and the last two are what keep a mode change from blanking the canvas:

- `availWidth` and `availHeight` are floored at 1. The row can genuinely be zero-sized for the
  frame before the flex layout runs, and a zero-sized paintBox makes every `toScreenPos` divide by
  zero and hand the canvas `NaN`.
- **the canvas offset is only re-measured while the canvas has a non-zero size.** A `display:none`
  canvas returns an all-zero rect, so `rect.left - frameRect.left` would evaluate to
  `-frameRect.left` and shift the graph by everything to the left of the row. `content` mode is
  exactly that case; the last known offset is kept instead. The test is on the rect `updateFrameBox`
  measures for itself, **not** on the stored `width`/`height` — those now survive a hide (next
  bullet), so testing them would let the shift back in.
- **`updateCanvasSize` returns early on a zero-sized rect**, keeping the last known size — same
  case, same reasoning. Writing `canvas.width = 0` would _discard the bitmap_, so the round trip
  through `content` mode blanked the graph on the way out and again on the way back. Nothing is
  visible to draw into meanwhile, so the stale size costs nothing and the painted graph survives.
- **the backing store is only written when the device-pixel size actually changed.** Every
  assignment to `canvas.width` or `canvas.height` is a clear, even one that writes the same number,
  and the observer fires for the frame as well as for the canvas.

**3. screen space** — paintBox after the d3 zoom transform `{x, y, k}`. Screen space is
**canvas-relative**, and that is the second thing the redesign changed: it used to coincide with
client coordinates, because the canvas was a full-screen `fixed top-0 left-0` element. It no longer
does. `CanvasScreen.toCanvasPos(event)` subtracts the element's `left`/`top`, and every pointer
handler goes through it. Skipping it shifts every hit test by the toolbar's height plus any left
offset, which reads as a coordinate-maths bug and is not one.

The only two crossings:

```js
toScreenPos({ x, y }); // viewBox → screen: normalise, scale into paintBox, apply transform
toViewBoxPos({ x, y }); // screen → viewBox: the exact inverse; used for hit-testing
```

Note the canvas is also `ctx.scale(dpr, dpr)`-ed for device pixel ratio, so **drawing
coordinates are CSS pixels, not device pixels**. `updateCanvasSize` is the only place `dpr` is
touched. Mixing it into a value that is already in CSS pixels is a bug — `getNode`'s hit radius
used to, and read twice as large on a retina display (`ISSUES.md` C7).

### The three classes in `canvas_graph.js`

#### `CanvasGraph` — data, hit-testing, and store wiring

Constructed with **one options object**:

```js
new CanvasGraph({
  nodes,
  links,
  viewBox,
  canvas,
  selection,
  filter,
  settings,
  onActivate,
  onHover,
  timeAxis // optional; null except for the date graph
});
```

`timeAxis` (`{originMs, msPerUnit}`) comes from the graph file through `ForceGraphView` as
`data.timeAxis ?? null`. When it is set, `GraphRenderer` draws the date axis. Every other graph
leaves it null and is drawn exactly as before.

It knows nothing about the app beyond that. `selection`, `filter` and `settings` are **read**;
the writes go out through `onActivate` and `onHover`. It imports no router — `onClick` used to
`goto()` directly, with a `// TODO: Replace by actual 'activate' function` sitting next to it.

Owns `nodes` (`Map<slug, Node>`) and `links` (`Map<sourceSlug, Map<targetSlug, Link>>`), plus their
filtered counterparts. Registers `click` and `pointermove` on the canvas, and builds the hit-test
grid and the glow data. `destruct()` must unsubscribe and unregister **everything** — the three
store subscriptions, both canvas listeners (matching the `pointermove` name exactly, or it leaks),
`screen.destruct()` and `renderer.destruct()`. This is no longer theoretical: swapping
visualizations unmounts the view.

A graph file stores a link as a pair of **slugs**, so the constructor resolves both endpoints
against `nodes` and stores `{source, target}` node _references_ — so a node and its links cannot
disagree. A link whose endpoints are missing is skipped, and a link from a build before the
`ISSUES.md` B1 fix, which carries embedded node objects instead of slugs, resolves through the same
path.

`onHover` suppresses itself on touch with `event.pointerType !== 'mouse'`, which is why the
listener is `pointermove` and not `mousemove` (`ISSUES.md` C9).

The `deferDraw` flag suppresses drawing during construction, because subscribing to a store fires
its callback synchronously before the object is fully built. Two subscriptions do that now, not
one.

#### `CanvasScreen` — coordinate spaces, sizing, zoom

Owns `viewBox`, `paintBox`, `transform`, `dpr`, the canvas element and the frame it is inset in.
Registers the `ResizeObserver` and the d3 zoom behaviour, and calls the two redraw callbacks it was
constructed with — the coalesced one for zoom, the synchronous one for resize (see _What triggers a
redraw_). It has no setters left: it observes those two elements instead of being told about
the world.

`destruct()` disconnects the observer and drops d3's zoom listeners with
`d3.select(canvas).on('.zoom', null)`.

The zoom is clamped to `scaleExtent([1, 15])`. `k = 1` is the **fit-to-frame** scale — the viewBox
is already letterboxed into the row — so there is nothing to see below it, and without the extent
zooming out ran forever (`ISSUES.md` C12). Note what that means in `split` mode: the fit is against
the row, so zooming out stops with part of the graph still behind the content pane. Panning is the
way to it, by decision; a lower bound derived from the visible canvas would put the scale back under
the layout's control and bring the jump back with it.

`transform` is **never rewritten from here** — `onResize` leaves it exactly as the user left it,
which is the entire fix for the graph jumping. If you ever do need to move it programmatically, go
through d3: it keeps its own copy of the transform on the element as `canvas.__zoom`, so assigning
`this.transform` alone makes the next wheel or drag jump back to d3's stale copy. That means keeping
the `zoomBehavior` from `addZoom` on `this` and calling `zoomBehavior.transform(selection, t)`.

#### `GraphRenderer` — all drawing, no state

`draw(nodes, links, glow, screen, selection, settings, timeAxis)` is the whole frame. `selection` and
`settings` arrive as two arguments because they are two stores: "which note is active" is app-wide
and "should links be drawn" belongs to this visualization alone. They used to be one `graphState`
object holding both.

It also owns the `theme` object and the dark-mode media query listener, pulling colours from
`virtual:tailwind-config` (see the root CLAUDE.md). `destruct()` removes that listener — it was
registered in the constructor and never removed, harmless while the graph was never unmounted and a
leak per swap now.

Draw order within a frame:

0. date gridlines (only with a `timeAxis`)
1. tag glow (if `showTagsGlow`)
2. links: all of them if `showConnections`, otherwise only those of the hovered and the selected
   note
3. all nodes
4. all labels, but only when `transform.k > 2`
5. the active and hovered nodes **again**, so they land on top
6. the date labels, in an opaque, borderless band along the canvas bottom (only with a `timeAxis`)

**The date axis** (`timeTicks`) converts the visible canvas x-range back into time through
`toViewBoxPos` and `timeAxis`, then lets `d3.scaleUtc` pick and format the ticks for about one tick
per 90 px. Zooming in therefore moves from months to days on its own, and panning moves the ticks
along. The band stays put vertically. Dates are UTC because the preprocessor writes every date as
UTC midnight.

**A node with `dateSource: 'mtime'`** (a note with no usable `created`, dated by its file's mtime)
is drawn with a dashed outline at 45% opacity, and so is its label, unless it is hovered or
selected. Nodes are hollow already, so hollowness alone would not set it apart.

Steps 1–4 are **culled against the visible box** — the whole canvas, computed
once per frame by `visibleBox()`. Everything above the fit-to-frame zoom draws
mostly off-screen, and all of it used to be painted anyway (`ISSUES.md` C4).
Since the paintBox is letterboxed into the row rather than into the canvas, this
is also what drops the part of the graph the content pane covers — the canvas is
the visible area, but it is no longer the whole drawing surface.
Each category gets its own slop, because each puts ink a different distance from
the node's centre:

- **nodes** — `nodeWidth`, half of the widest a node is drawn (`drawNode`
  doubles it when hovered or selected)
- **glow** — `glow.maxShift * (glowPixelWidth + glowPixelGap) * k`. `maxShift`
  is measured in `generateGlow` rather than derived from the sampling
  parameters, because the offsets are normal samples and how far into the tail
  they went is a property of the draw
- **labels** — `isLabelVisible`, which is deliberately **asymmetric**: a label
  is drawn to the _right_ of its node, so a node off the left edge can still
  show one but a node off the right edge cannot. A symmetric margin would keep
  a 400px strip of invisible labels along the right edge
- **links** — `isLinkVisible` rejects only when **both** endpoints are outside
  the _same_ edge. A link with endpoints off opposite edges still crosses the
  screen; testing the endpoints one at a time would drop it

Step 5 is not culled — it is two nodes.

The hit-test grid is deliberately _not_ reused for this. It holds `nodes`, not
`filteredNodes`, so enumerating cells would mean intersecting the two sets every
frame, and the per-node loop is not what costs: the draw calls are. Measured on
a 2000-node/6000-link graph in a 1600×900 viewport, culling takes the ink
operations per frame from 44,000 to 10,609 at `k = 5` and to 3,904 at `k = 15`.
At `k = 1` in `viz` mode it changes nothing at all and costs about 7% of the
frame's JS — the whole graph is on screen, so every test passes. In `split` mode
at `k = 1` it now drops the ~38% of the graph the content pane covers.

### What triggers a redraw

- d3 zoom (`CanvasScreen.onZoom`) — on every wheel/drag event
- the canvas or the frame changing size (`CanvasScreen.onResize`, from the `ResizeObserver`)
- `selection` changes (`CanvasGraph.onSelectionChange`)
- `settings` changes (`CanvasGraph.onSettingsChange`)
- `filter` changes (`CanvasGraph.onFilterChange`)
- the `prefers-color-scheme` media query (`GraphRenderer.onDarkMode`)

They all call `draw()` — **except the resize, which must not**. `draw()` is not the painting code:
it schedules `drawNow()` on a `requestAnimationFrame` and holds the pending frame id, so the several
requests that routinely land within one frame collapse into a single paint (`ISSUES.md` C2).
`destruct()` cancels a pending frame; `deferDraw` still suppresses drawing outright during
construction.

**`CanvasScreen.onResize` goes through `drawSync` instead, and that is load-bearing.**
`updateCanvasSize` clears the bitmap, and a `ResizeObserver` callback runs after layout but _before_
that frame is painted — so deferring the repaint to the next frame painted one empty canvas on every
resize notification. That is what the flicker on every layout-mode change was, twice over for a trip
through `content` mode, and it is why the graph lagged a frame behind the divider for the whole of a
drag. `drawSync` drops an already-scheduled frame and paints now; `CanvasGraph` hands it to
`CanvasScreen` as a fourth constructor argument beside `draw`. Nothing else should use it.

Three of those sources are also quiet at the source, so most of the events never reach `draw()` at
all: each store subscription compares the new state object by **reference** and returns early if it
is the one already held, `selection.hover()` returns the state object untouched when the hovered
slug has not changed — which is what stops a full redraw on every pointermove over a node
(`ISSUES.md` C1) — and `onFilterChange` returns early when `newFilter.results` is the same
reference as the maps were last built from, which only works because `filter.apply` writes `query`
and `results` in one update rather than two (`ISSUES.md` C11). Its earlier write of `text` alone
leaves `results` untouched, so it returns early too.

### Hit-testing

`getNode(screenPos)` takes a **canvas-relative** position — `toCanvasPos` has already subtracted
the element offset — converts it to viewBox space, finds the grid cell, and linearly scans that
cell for a node within `eps` (10 CSS pixels). The grid is uniform, built once in `constructGrid()`
and sized by **node count, not by the viewBox**: `cellSize = sqrt(area / ceil(N / 4))`, so a cell
holds about four nodes however large the collection is. It used to be
`min(viewBox.width, viewBox.height) / 5` — roughly 5×5 cells for the whole graph, so every
mousemove scanned on the order of N/25 nodes (`ISSUES.md` C6).

The two callers of `toGridIdxs` treat out-of-grid indices differently, deliberately: `getNode`
**rejects** them, because a pointer outside the graph should hit nothing, while `fillGrid`
**clamps** them via `clampGridIdx`, because a node landing on the padded viewBox boundary still
has to go in a cell. `constructGrid` also floors `cellSize` and the row/column counts, so a
zero-sized viewBox (one note, or every node at the same point) cannot produce `Array(NaN)`.

Both `onClick` and `onHover` additionally check `filteredNodes.has(slug)`, so filtered-out nodes
are neither clickable nor hoverable even though they may still be drawn.

### Tag glow

Each node's frontmatter `tags` become a cloud of translucent squares around it. `generateGlow()`
runs once at construction:

- every distinct tag across all notes gets a hue, evenly spaced around the 360° wheel
- each node gets `numGlowPixels` (20) squares, split evenly across its tags
- each square's offset is `floor(sample_normal(random) * 5)` grid steps from the node — a
  Box–Muller normal sample, so the cloud is denser near the centre

`generateGlow()` also resolves each tag's hue into a **pair of hex colours**, `{light, dark}` —
the saturation differs (30% / 50%) and the variant is picked once per node from `theme.darkMode`.
`drawNodeGlow` then only indexes a map; it used to build an `hsla()` string and run it through
`d3.color(...).formatHex()` inside the pixel loop, 20 squares × every node × every frame
(`ISSUES.md` C3). `formatHex()` drops the `0.4` alpha, so the glow has always been opaque — that is
preserved, precomputing it changed nothing but the cost.

Nodes with no tags get no glow.

The offsets come from `mulberry32` seeded with an FNV-1a hash of the node's **slug**, not from
`Math.random()`, so a node's cloud is the same on every page load (`ISSUES.md` C14). Seeding per
node rather than once per run is what makes it independent of the collection: adding a note does not
reshuffle everything else. Same argument as node positions in A14, but solved in the frontend —
serialising 20 pixel records per node into a graph file costs more than
the hash does.

## Type definitions

`canvas_graph.js` carries the JSDoc typedefs the rest of the force graph refers to: `Node`, `TimeAxis`, `Link`,
`GlowPixel`, `FrontMatter`, `SelectionState`, `SelectionStore`, `ForceGraphSettings`,
`SettingsStore`, `FilterState`, `FilterStore`. Keep them next to the code they describe.
`FilterState` names the search module's `ParsedQuery` and `Match` types; nothing outside this
directory imports types from it.

The store typedefs here are **`Readable`**, deliberately narrower than the real stores in
`state/`: this code only ever subscribes.
