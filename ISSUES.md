# Known issues

Structural bugs and non-optimal paths still open. Line references are anchors, not guarantees --
they will drift.

**Read this before fixing something.** What is left here is left deliberately, with the reason
recorded -- do not "fix" it without reading why it is still here.

Everything else the audit that produced this file found has been fixed, and those entries are
gone. Comments in the code and in the nested `CLAUDE.md` files still cite them by number
(`ISSUES.md A6`); those pointers now dangle, but the prose around each one explains its own
mechanism.

`C5` is what the audit left open. `D1` and `D2` are new, and are not bugs the audit missed — they
are places where the UI redesign chose a smaller scope on purpose, recorded here so the next reader
does not mistake them for oversights. `A21` and `D3` came with the date graph.

---

### A21. `isDeepEqual` treats every `Date` as equal

`preprocessor/util.js`'s `isDeepEqual` compares objects by `Object.getOwnPropertyNames`, and a
`Date` has none, so any two `Date`s compare equal. js-yaml parses an unquoted frontmatter date
(`created: 2026-02-11`) into a `Date`, so editing one in `watch` does not mark `matter` as changed,
and the emitters that embed `matter` (the per-note JSON, `index.json`, the graphs) keep the old
value until something else about the note changes. A record that came back from the cache holds the
ISO string instead, because the cache is JSON.

**Left open deliberately.** The date graph does not depend on it: it reads `record.created`, a number
the parse derives from that `Date`, and `created` is diffed on its own. Fixing it means deciding
whether `matter` should be normalised to plain JSON at parse time, which changes what every consumer
of `matter` sees.

---

### C5. Per-point transforms in JS

`toScreenPos` is called for every node and both endpoints of every link, every frame, doing four
multiplies and four adds each. Setting `ctx.setTransform` once and drawing in viewBox
coordinates hands the same work to the canvas implementation. Note this would also change how
line widths and font sizes must be specified.

**Left open deliberately.** Every node width, line width and font size in `GraphRenderer` is
currently in CSS pixels; moving the transform into the context rescales all of them at once, which
is a rewrite of the renderer rather than an optimisation of it.

Viewport culling landed first and takes most of what this would have bought: `toScreenPos` now runs
only for what is on screen, which above the fit-to-window zoom is a small fraction of the graph.
Whoever picks this up has to move the cull test with it — `visibleBox`, `isNodeVisible`,
`isLabelVisible` and `isLinkVisible` all compare against screen-space coordinates, and they would
have to be expressed in viewBox space instead.

The redesign made that slightly easier: the visualization is a real flex pane now, so the canvas is
the whole drawing surface and `visibleBox` is plain canvas space with no inset subtracted from its
right edge. `insetRight` and `setInsetRight` are gone with it — the C13 workaround for a canvas
that had a content pane painted over it.

---

### D1. Tiles are equal-width only

`ContentPane` lays its columns out as `flex-1` siblings, so N notes always get `1/N` of the content
area each. `TileDivider` between them is decoration: it is deliberately the same `shrink-0 w-1` box
as `shell/PaneDivider.svelte`, so making it draggable is adding handlers rather than redoing the
layout, but nobody has.

**Left open deliberately.** Per-column widths need a place to live in the URL contract
(`?tile=` is a bare repeated slug today) and a rule for what happens when a column is closed.
Neither is worth designing until side-by-side reading has been used enough to know whether the
fixed split is actually a problem.

### D2. There is no mobile layout

The application shell assumes a pointer, a keyboard and enough width for two panes beside each
other. The half-finished mobile branch — `Adaptive.svelte`'s slot switch, `MobileToolbar`,
`MobileGraphInterface`, `MobileNoteContainer` — was **deleted** rather than carried through the
redesign, and nothing replaced it. Below about 640px the toolbar sections collide and the split
view is unusable.

`src/lib/adaptive/` survives: `MediaQuery.svelte` and `WithAdaptiveContext.svelte` are clean,
self-contained, and mounted by nothing. They are the starting point for whoever does this.

**Left open deliberately.** A mobile shell is a different information architecture — one pane at a
time, the visualization as a mode rather than a neighbour — not a set of breakpoints on this one.
Deleting the half-built version was the honest move; pretending the current one degrades gracefully
would not be.

### D3. The date graph is a thin strip

The date graph's x is time and its y is whatever the forces spread out, so its viewBox is many times
wider than tall (about 19:1 on `test_notes`). `CanvasScreen` letterboxes with one scale for both
axes and `d3.zoom` zooms uniformly, so the graph sits as a band across the middle of the pane and
same-day notes overlap until you zoom in. `UNITS_PER_DAY` and the `date` layout's forces in
`emitters/graph/layouts.js` change the proportions, but not the shape.

**Left open deliberately.** Fixing it properly means separate x and y scales in `CanvasScreen`: a
paintBox that is not aspect-preserving, and probably a zoom that stretches only time. The
coordinate-space code is the most delicate in the renderer (see `src/lib/viz/CLAUDE.md`). That is
worth doing once the date graph has been used enough to know it is needed.
