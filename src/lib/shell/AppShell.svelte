<script>
  import { useAppState, LAYOUT, OVERLAY, TILES } from '$lib/state/keys.js';
  import Toolbar from '$lib/toolbar/Toolbar.svelte';
  import VizPane from '$lib/viz/VizPane.svelte';
  import ContentPane from '$lib/content/ContentPane.svelte';
  import PaneDivider from './PaneDivider.svelte';

  /**
   * The application shell: a toolbar strip across the top, and below it the
   * visualization and content panes as real flex siblings.
   *
   * This replaces the old arrangement, where a `fixed` full-screen canvas sat
   * behind a `fixed right-0` pane and the canvas had to be told how much of its
   * right edge was covered. Nothing here is `fixed`, so nothing needs telling.
   *
   * `min-h-0` on the body row and `min-w-0` on each pane are not decoration: a
   * flex item refuses to shrink below its content's intrinsic size without
   * them, and the scroll containers inside then never scroll.
   */

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));

  /**
   * The app's keyboard shortcuts, all of them, in one window-level handler.
   *
   * | Ctrl/Cmd+K, /      | search    |
   * | Ctrl/Cmd+Shift+F   | filter    |
   * | Ctrl/Cmd+Shift+P   | commands  |
   * | Escape             | close the overlay |
   * | Ctrl/Cmd+\\        | split the focused note right |
   * | Ctrl/Cmd+B         | cycle the layout |
   *
   * They live here rather than in the components they drive because a shortcut
   * has to work when nothing in particular is focused, and because a handler
   * per overlay would only run once that overlay was already open.
   *
   * @param {KeyboardEvent} ev
   */
  function onKeydown(ev) {
    // Escape is the one key that must still work from inside a text field —
    // it is how you leave the overlay you are typing in. It is handled *here*
    // and nowhere else: `OverlayShell` deliberately has no key handler, and
    // `overlay/focus_trap.js` sees only Tab, so no two handlers race on the
    // same key. (The shell's ✕ is a second *closer*, calling the same action —
    // an opaque full-pane modal has no backdrop left to click.)
    if (ev.key === 'Escape') {
      if (!$overlay.kind) return;
      ev.preventDefault();
      overlay.close();
      return;
    }

    // Everything below would otherwise eat characters as you type — `/` most
    // obviously, but Ctrl+B and Ctrl+K are text-editing keys in some fields too.
    const target = ev.target;
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (typing) return;

    const mod = ev.ctrlKey || ev.metaKey;
    // With Shift held, `ev.key` is the upper-case letter.
    const key = ev.key.toLowerCase();

    if (!mod) {
      if (key === '/') {
        ev.preventDefault();
        overlay.toggle('search');
      }
      return;
    }

    if (ev.shiftKey) {
      if (key === 'f') {
        ev.preventDefault();
        overlay.toggle('filter');
      } else if (key === 'p') {
        ev.preventDefault();
        overlay.toggle('commands');
      }
      return;
    }

    if (key === 'k') {
      ev.preventDefault();
      overlay.toggle('search');
    } else if (key === '\\') {
      ev.preventDefault();
      tiles.splitRight();
      // A new column is invisible while the content pane is hidden, and this
      // shortcut works in every mode. A no-op unless the mode is `viz`.
      layout.reveal();
    } else if (key === 'b') {
      ev.preventDefault();
      layout.cycle();
    }
  }

  /**
   * The body row, measured by two things.
   *
   * `PaneDivider` turns a pointer position into a fraction against it, and is
   * handed it as a prop — bound here rather than in the divider because the
   * divider is only mounted in `split` mode and is not the element being
   * measured.
   *
   * The force graph's renderer also measures it, and finds it for itself:
   * `CanvasScreen` does `canvas.closest('[data-viz-frame]')` and letterboxes the
   * graph into the row rather than into its own canvas, so the graph's
   * coordinates do not move when the panes are resized or the mode changes. The
   * attribute rather than a prop, because the `View` contract in
   * `viz/CLAUDE.md` is `{data, settings, callbacks}` and the shell's geometry is
   * not every visualization's business.
   *
   * @type {HTMLElement | undefined}
   */
  let bodyEl;

  /**
   * Both panes are **always mounted** and hidden with `display:none`, never
   * removed with `{#if}`. Unmounting throws away what the pane was showing:
   * `VizPane` remounts `<svelte:component>`, which rebuilds `CanvasGraph` from
   * scratch — the transform goes back to identity and the user's zoom and pan
   * are gone — and `ContentPane` drops every tile's rendered note.
   *
   * A hidden canvas measures `0 x 0`; that is safe because the graph is
   * letterboxed into this row rather than into the canvas, so the mapping
   * survives the round trip untouched, and the `ResizeObserver` fires again with
   * the real size when the pane comes back.
   *
   * `display:none` does destroy the scroll boxes inside the content pane, so
   * `ContentPane` snapshots and restores its tiles' offsets across a hide —
   * see `content/scroll_memory.js`'s `hold()`.
   */
  /**
   * **The grow factor is `1` in the single-pane modes, not the pane's
   * fraction.** This is the one bit of flex arithmetic here that does not do
   * what it looks like: when the flex-grow factors of a line sum to *less than
   * 1*, the items share only that much of the free space (CSS Flexbox §9.7) —
   * the remainder is simply left empty. With `flex-basis: 0%` all the space is
   * free, so a lone pane at `flex: 0.618` painted across 61.8% of the row and
   * left a blank 38.2% strip of body-row background beside it, looking for all
   * the world like an empty div covering the graph. `content` mode had the
   * mirror of it at 38.2%.
   *
   * In `split` the two factors are `f` and `1 - f`, which sum to exactly 1, so
   * that mode was always correct and hid the bug.
   */
  $: vizGrow = $layout.mode === 'viz' ? 1 : $layout.vizFraction;
  $: contentGrow = $layout.mode === 'content' ? 1 : 1 - $layout.vizFraction;

  $: vizStyle = $layout.mode === 'content' ? 'display: none' : `flex: ${vizGrow} 1 0%`;
  $: contentStyle = $layout.mode === 'viz' ? 'display: none' : `flex: ${contentGrow} 1 0%`;
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="h-screen w-screen flex flex-col overflow-hidden
         bg-back-light dark:bg-back-dark text-front-light dark:text-front-dark"
>
  <Toolbar />
  <div bind:this={bodyEl} data-viz-frame class="flex-1 min-h-0 flex flex-row">
    <VizPane style={vizStyle} />
    {#if $layout.mode === 'split'}
      <PaneDivider {bodyEl} />
    {/if}
    <ContentPane style={contentStyle} hidden={$layout.mode === 'viz'} />
  </div>
</div>
