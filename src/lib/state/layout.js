import { writable } from 'svelte/store';

/**
 * @typedef {'split'|'viz'|'content'} LayoutMode
 * @typedef {{mode: LayoutMode, vizFraction: number, lastSplitFraction: number}} LayoutState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<LayoutState>['subscribe'],
 *   cycle: () => void,
 *   setMode: (mode: LayoutMode) => void,
 *   reveal: () => void,
 *   setVizFraction: (f: number) => void,
 *   confirmFraction: () => void,
 * }} LayoutStore
 */

const goldenRatio = (1 + Math.sqrt(5)) / 2;

/** The visualization's share of the body row when split. ~0.618. */
export const DEFAULT_VIZ_FRACTION = 1 / goldenRatio;

/** Drag past these and the divider snaps to a single-pane mode. */
const SNAP_LOW = 0.1;
const SNAP_HIGH = 0.9;

/** Clicking the visualization name walks this cycle. */
const CYCLE = /** @type {LayoutMode[]} */ (['split', 'viz', 'content']);

/**
 * The visualization/content split — one store, replacing the two
 * bidirectionally-synced ones (`contentState` and `contentSliderState`) this
 * supersedes. There is nothing to keep in sync any more: `mode` and
 * `vizFraction` are fields of the same object, so they cannot oscillate.
 *
 * `vizFraction` is the visualization pane's share of the body row, 0..1. It is
 * only meaningful in `split` mode; the pane components read `mode` to decide
 * what to render at all.
 *
 * @param {Partial<LayoutState>} [initial]
 * @returns {LayoutStore}
 */
export function createLayoutState(initial = {}) {
  const start = /** @type {LayoutState} */ ({
    mode: initial.mode ?? 'split',
    vizFraction: initial.vizFraction ?? DEFAULT_VIZ_FRACTION,
    lastSplitFraction: initial.lastSplitFraction ?? initial.vizFraction ?? DEFAULT_VIZ_FRACTION
  });

  const { subscribe, update } = writable(start);

  /**
   * `lastSplitFraction` is what makes collapsing and re-expanding restore the
   * width the user chose, rather than snapping back to the golden ratio.
   *
   * @param {LayoutMode} mode
   */
  function setMode(mode) {
    update((values) => {
      if (values.mode === mode) return values;
      return {
        ...values,
        mode,
        vizFraction: mode === 'split' ? values.lastSplitFraction : values.vizFraction
      };
    });
  }

  /**
   * Make the content pane visible if it is not. Called when something opens
   * *into* the content pane — an overlay, or a note — from a control that is
   * still on screen while the pane is hidden: a graph node, a history chip, the
   * Split button. Without it the note lands in a `display: none` column and the
   * click looks like it did nothing.
   *
   * Only `viz` is widened, and deliberately not via `setMode('split')`, which
   * would drag `content` mode into split as well. There the pane is already the
   * whole body row, and hiding the visualization is what the user asked for.
   *
   * The reveal is one-way: closing the overlay or the note does not snap back.
   * Nothing in this app silently undoes itself — closing the filter overlay
   * leaves the filter applied for the same reason.
   */
  function reveal() {
    update((values) =>
      values.mode !== 'viz'
        ? values
        : { ...values, mode: 'split', vizFraction: values.lastSplitFraction }
    );
  }

  function cycle() {
    update((values) => {
      const next = CYCLE[(CYCLE.indexOf(values.mode) + 1) % CYCLE.length];
      return {
        ...values,
        mode: next,
        vizFraction: next === 'split' ? values.lastSplitFraction : values.vizFraction
      };
    });
  }

  /**
   * Called continuously while the divider is dragged. Deliberately does not
   * touch `mode` or `lastSplitFraction` — a drag in progress is not yet a
   * decision. `confirmFraction()` on pointerup is.
   *
   * @param {number} f
   */
  function setVizFraction(f) {
    const clamped = Math.min(Math.max(f, 0), 1);
    update((values) =>
      values.vizFraction === clamped ? values : { ...values, vizFraction: clamped }
    );
  }

  function confirmFraction() {
    update((values) => {
      const f = values.vizFraction;
      if (f < SNAP_LOW) return { ...values, mode: 'content' };
      if (f > SNAP_HIGH) return { ...values, mode: 'viz' };
      return { ...values, mode: 'split', lastSplitFraction: f };
    });
  }

  return { subscribe, cycle, setMode, reveal, setVizFraction, confirmFraction };
}

/**
 * The mode the shell actually *shows*, which is not always the stored one.
 *
 * With no note open and no overlay up, the content pane would have nothing to
 * show, so it is hidden and the visualization takes the whole row — whatever
 * `mode` says. `mode` itself is left alone: it is the user's choice and lives
 * in `?layout=`, so opening a note brings their split or content mode back
 * without anything having to remember it.
 *
 * The overlay term is there because `OverlayHost` is mounted inside the content
 * pane: search opened from `/` has to bring the pane up to be seen at all.
 *
 * @param {LayoutMode} mode
 * @param {boolean} hasTiles
 * @param {boolean} overlayOpen
 * @returns {LayoutMode}
 */
export function visibleMode(mode, hasTiles, overlayOpen) {
  if (mode === 'viz' || hasTiles || overlayOpen) return mode;
  return 'viz';
}
