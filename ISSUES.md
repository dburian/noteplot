# Known issues

Structural bugs and non-optimal paths still open, grouped by area. Line references are anchors,
not guarantees -- they will drift.

**Read this before fixing something.** Several items look like small bugs but are symptoms of a
design decision that was started and never finished; those are marked as such. Others are left
open deliberately, with the reason recorded -- do not "fix" one without reading why it is still
here.

The entries fixed during the audit that produced this file have been deleted. Comments in the
code and in the nested `CLAUDE.md` files still cite them by number (`ISSUES.md A6`); those
pointers now dangle, but the prose around each one explains its own mechanism.

---

## C. Rendering / visualisation

### C4. No viewport culling

Every node, every link, and — above `k > 2` — every label is drawn regardless of whether it is
on screen. At high zoom that is almost entirely wasted work. Cull against the paintBox; the
hit-test grid could serve double duty here.

**Left open deliberately.** The rendering pass fixed the per-frame waste that cost nothing to fix --
redundant hover redraws, `requestAnimationFrame` batching, per-pixel colour parsing; culling changes
what the renderer iterates and wants measuring against a real collection first, so it was not
attempted blind.

### C5. Per-point transforms in JS

`toScreenPos` is called for every node and both endpoints of every link, every frame, doing four
multiplies and four adds each. Setting `ctx.setTransform` once and drawing in viewBox
coordinates hands the same work to the canvas implementation. Note this would also change how
line widths and font sizes must be specified.

**Left open deliberately.** Every node width, line width and font size in `GraphRenderer` is
currently in CSS pixels; moving the transform into the context rescales all of them at once, which
is a rewrite of the renderer rather than an optimisation of it.

### C14. The glow pattern changes on every page load

`generateGlow` calls `Math.random()` (via `sample_normal`) at runtime, so a node's tag cloud is
laid out differently every time the page is opened. Seed the RNG, or move glow generation into
the preprocessor and serialise it — the same argument as for node positions.
