# `src/lib/graph` — the canvas renderer

> **Keep this file current.** In particular, if you change the coordinate maths in
> `CanvasScreen`, update the coordinate-space section below in the same commit — it is the part
> of this codebase that is hardest to reconstruct by reading.

## Why this is not Svelte components

The graph renders hundreds of nodes and redraws on every zoom, hover, and filter change. It is
therefore **imperative canvas code in plain `.js`**, not components. The Svelte side is only a
mount point.

```
GraphContainer.svelte   full-screen fixed div
└─ GraphCanvas.svelte   a <canvas> + onMount → new CanvasGraph(...) → graph.draw()
                        teardown calls graph.destruct()
```

`GraphCanvas` reads `graphState` and `filterState` from context and hands the **stores** to
`CanvasGraph`, which subscribes to them directly. Svelte reactivity stops at that boundary:
nothing below re-runs when props change. `CanvasGraph` is built **once, in `onMount`**, from
whatever `nodes`/`links`/`viewBox` it was given. Changing those props later has no effect. That
is fine today because the graph data is static per build, but it is the constraint to know
before making the graph dynamic.

`Graph.svelte` / `GraphNode.svelte` were an earlier SVG implementation of the same thing. They
have been removed; if you find references, they are stale.

## The three coordinate spaces

This is the single most confusing thing in the repo. Every position passes through three spaces,
and `CanvasScreen` owns all conversions between them.

**1. viewBox space** — layout coordinates produced by `graph_pipeline.js`. Node `x`/`y` come
straight from the d3 force simulation, translated so the bounding box starts at the origin, with
10% padding added around it. `__graph.json`'s `viewBox` is `[minX, minY, width, height]`, mirroring
the SVG attribute it is named after. Nothing about this space depends on the browser.

`width` and `height` are always positive: `graph_pipeline.js` floors both at `MIN_VIEW_BOX_SIZE`
and emits a default box for an empty collection. The frontend divides by them and sizes the
hit-test grid from them, so a zero would be fatal — see `ISSUES.md` A17.

Within a running watch session this space is **stable**. `graph_pipeline.js` keeps the positions it
has computed in memory and pins every node that has one (`fx`/`fy`) whenever the simulation re-runs,
so only new nodes relax; the pins are stripped before serialising, which is why nothing in
`__graph.json` mentions them. Positions are deliberately **not** persisted, so restarting the
preprocessor re-lays the whole graph from scratch — intended, not a regression (`ISSUES.md` A14).
The one caveat: a new node landing left of or above the existing extent shifts every coordinate by
the same amount, because the bounding box is always re-originated. Nodes never move _relative to
each other_.

**2. paintBox space** — CSS pixels. The viewBox is letterboxed into the window while preserving
aspect ratio, so `paintBox` is `{minX, minY, width, height}` describing where the graph actually
sits inside the canvas. `updatePaintBox()` recomputes it on resize: whichever axis is relatively
tighter gets the full window, the other is centred.

**3. screen space** — paintBox after the d3 zoom transform `{x, y, k}`.

The only two crossings:

```js
toScreenPos({ x, y }); // viewBox → screen: normalise, scale into paintBox, apply transform
toViewBoxPos({ x, y }); // screen → viewBox: the exact inverse; used for hit-testing
```

Note the canvas is also `ctx.scale(dpr, dpr)`-ed for device pixel ratio, so **drawing
coordinates are CSS pixels, not device pixels**. Mixing `dpr` into a value that is already in CSS
pixels is a bug (there is one such case — ISSUES.md C7).

## The three classes in `canvas_graph.js`

### `CanvasGraph` — data, hit-testing, and store wiring

Owns `nodes` (`Map<slug, Node>`) and `links` (`Map<sourceSlug, Map<targetSlug, Link>>`), plus
their filtered counterparts. Subscribes to `graphState` and `filterState`, registers `click` and
`pointermove` on the canvas, and builds the hit-test grid and the glow data. `destruct()` must
unsubscribe and unregister everything — including matching the `pointermove` name exactly, or the
listener leaks.

`__graph.json` stores a link as a pair of **slugs**, so the constructor resolves both endpoints
against `nodes` and stores `{source, target}` node _references_ — so a node and its links cannot
disagree. A link whose endpoints are missing is skipped, and a link from a build before the
`ISSUES.md` B1 fix, which carries embedded node objects instead of slugs, resolves through the same
path.

`onHover` suppresses itself on touch with `event.pointerType !== 'mouse'`, which is why the
listener is `pointermove` and not `mousemove` (ISSUES.md C9).

The `deferDraw` flag suppresses drawing during construction, because subscribing to a store fires
its callback synchronously before the object is fully built.

### `CanvasScreen` — coordinate spaces, sizing, zoom

Owns `viewBox`, `paintBox`, `transform`, `dpr`, and the canvas element. Registers the `resize`
listener and the d3 zoom behaviour. Calls the `redraw` callback it was constructed with.

### `GraphRenderer` — all drawing, no state

`draw(nodes, links, glow, screen, state)` is the whole frame. It also owns the `theme` object and
the dark-mode media query listener, pulling colours from `virtual:tailwind-config` (see the root
CLAUDE.md).

Draw order within a frame:

1. tag glow (if `showTagsGlow`)
2. links (if `showConnections`)
3. all nodes
4. all labels, but only when `transform.k > 2`
5. the active and hovered nodes **again**, so they land on top

## What triggers a redraw

All of these call `draw()` **synchronously** — there is no `requestAnimationFrame` batching, so
several can land in the same frame (ISSUES.md C2):

- d3 zoom (`CanvasScreen.onZoom`) — on every wheel/drag event
- window resize (`CanvasScreen.onResize`)
- `graphState` changes (`CanvasGraph.onGraphStateChange`) — including **every pointermove over a
  node**, because `hover()` always allocates a new state object (ISSUES.md C1)
- `filterState` changes (`CanvasGraph.onFilterChange`) — twice per query, since `FilterWindow`
  calls `setQuery` then `setResults`
- the `prefers-color-scheme` media query (`GraphRenderer.onDarkMode`)

## Hit-testing

`getNode(screenPos)` converts to viewBox space, finds the grid cell, and linearly scans that
cell for a node within `eps`. The grid is uniform, built once in `constructGrid()` with
`cellSize = min(viewBox.width, viewBox.height) / 5` — i.e. roughly **5×5 cells for the entire
graph**, regardless of node count (ISSUES.md C6).

The two callers of `toGridIdxs` treat out-of-grid indices differently, deliberately: `getNode`
**rejects** them, because a pointer outside the graph should hit nothing, while `fillGrid`
**clamps** them via `clampGridIdx`, because a node landing on the padded viewBox boundary still
has to go in a cell. `constructGrid` also floors `cellSize` and the row/column counts, so a
zero-sized viewBox (one note, or every node at the same point) cannot produce `Array(NaN)`.

Both `onClick` and `onHover` additionally check `filteredNodes.has(slug)`, so filtered-out nodes
are neither clickable nor hoverable even though they may still be drawn.

## Tag glow

Each node's frontmatter `tags` become a cloud of translucent squares around it. `generateGlow()`
runs once at construction:

- every distinct tag across all notes gets a hue, evenly spaced around the 360° wheel
- each node gets `numGlowPixels` (20) squares, split evenly across its tags
- each square's offset is `floor(sample_normal() * 5)` grid steps from the node — a
  Box–Muller normal sample, so the cloud is denser near the centre

Nodes with no tags get no glow. The offsets use `Math.random()` at runtime, so the pattern
differs on every page load (ISSUES.md C14), and the per-square colour is re-parsed from an
`hsla()` string on **every frame** (ISSUES.md C3).

## Type definitions

`canvas_graph.js` carries the JSDoc typedefs the rest of the graph code refers to: `Node`,
`Link`, `GlowPixel`, `FrontMatter`, `GraphState`, `GraphStateStore`, `FilterState`,
`FilterStateStore`. Keep them next to the code they describe.
