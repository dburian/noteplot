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
does not mistake them for oversights.

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
