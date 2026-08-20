# Known issues

Structural bugs and non-optimal paths still open. Line references are anchors, not guarantees --
they will drift.

**Read this before fixing something.** What is left here is left deliberately, with the reason
recorded -- do not "fix" it without reading why it is still here.

Everything else the audit that produced this file found has been fixed, and those entries are
gone. Comments in the code and in the nested `CLAUDE.md` files still cite them by number
(`ISSUES.md A6`); those pointers now dangle, but the prose around each one explains its own
mechanism.

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
