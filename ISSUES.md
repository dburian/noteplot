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

## A. Build pipeline — correctness

### A19. Two notes embedding the same image fight over one file

_Surfaced by fixing `isDeepEqual`'s array branch, which is what made the image-removal path run
at all._

`unify_pipelines.js`, `collectImgs` derives an image's destination from the **image's own** path
(`toSlug(absolutePath, noteRoot, {withExtension: true})`), so `img.png` referenced by two notes is
copied to one file in `static/note_imgs/` and appears in **both** notes' `images` arrays.

Deleting either note, or editing either note to drop the image, therefore removes the file the
other note still points at — a broken image with no error anywhere. The remaining note only gets
it back when it is next re-parsed.

`{force: true}` on the `rm` calls keeps this from crashing the pipeline, which is all that
has been done. A real fix needs per-image reference counting in `NotePipeline` — an
`image → Set<slug>` map alongside `backlinks`, with the `rm` deferred until the last referrer drops
it. The same map would let a restart notice orphaned images, which nothing currently prunes.

## B. Data flow

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
data-flow pass around it left both flags exactly where they were.

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
the preprocessor and serialise it — the same argument as for node positions.
