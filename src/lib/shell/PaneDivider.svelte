<script>
  import { useAppState, LAYOUT } from '$lib/state/keys.js';

  /**
   * The draggable split between the visualization and the content pane.
   *
   * Uses **pointer capture**, not listeners on `document.body`. The component
   * this replaces (`toolbar/buttons/ResizeContent.svelte`) attached
   * `mousemove`, `mouseup` and `mouseleave` to the body and removed only the
   * first on release, leaking a pair per drag. Capture makes that structurally
   * impossible: the element keeps receiving pointer events until it releases.
   */

  /**
   * The body row to measure against. Not `document.body`: the row is inset by
   * the toolbar and can be inset horizontally too.
   *
   * @type {HTMLElement | undefined}
   */
  export let bodyEl = undefined;

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));

  let dragging = false;

  /** @param {PointerEvent & {currentTarget: HTMLElement}} ev */
  function down(ev) {
    if (!bodyEl) return;
    dragging = true;
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }

  /** @param {PointerEvent & {currentTarget: HTMLElement}} ev */
  function move(ev) {
    if (!dragging || !bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    layout.setVizFraction((ev.clientX - rect.left) / rect.width);
  }

  /**
   * `confirmFraction()` may snap the mode and unmount this component. Capture
   * is released first, so that is safe.
   *
   * @param {PointerEvent & {currentTarget: HTMLElement}} ev
   */
  function up(ev) {
    if (!dragging) return;
    dragging = false;
    ev.currentTarget.releasePointerCapture(ev.pointerId);
    layout.confirmFraction();
  }
</script>

<div
  role="separator"
  aria-orientation="vertical"
  class="shrink-0 w-1 cursor-col-resize touch-none
         bg-muted-light dark:bg-muted-dark
         hover:bg-emphasis-light dark:hover:bg-emphasis-dark"
  on:pointerdown|preventDefault={down}
  on:pointermove={move}
  on:pointerup={up}
  on:pointercancel={up}
/>
