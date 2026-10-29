import { writable } from 'svelte/store';

/**
 * @typedef {'search'|'filter'|'commands'|'settings'|'shortcuts'} OverlayKind
 * @typedef {{kind: OverlayKind | null, query: string}} OverlayState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<OverlayState>['subscribe'],
 *   open: (kind: OverlayKind) => void,
 *   toggle: (kind: OverlayKind) => void,
 *   close: () => void,
 *   setQuery: (q: string) => void,
 * }} OverlayStore
 */

/** @type {OverlayKind[]} */
export const OVERLAY_KINDS = ['search', 'filter', 'commands', 'settings', 'shortcuts'];

/**
 * The modal over the content area — search, filter, the command palette, or
 * settings. `shortcuts` is settings' one sub-page: a kind of its own rather
 * than a field beside `kind`, so `?overlay=shortcuts` needs nothing new in the
 * URL and `OverlayHost`'s focus restore already spans moving between them.
 * These used to be the `/search` and `/filter` routes; they are overlays now
 * so they can open on top of whatever you are reading without replacing it,
 * and so the graph stays visible and usable underneath.
 *
 * `query` is shared across kinds deliberately: switching from search to filter
 * with the same text typed is a thing people do.
 *
 * @param {Partial<OverlayState>} [initial]
 * @returns {OverlayStore}
 */
export function createOverlayState(initial = {}) {
  const { subscribe, update } = writable(
    /** @type {OverlayState} */ ({ kind: initial.kind ?? null, query: initial.query ?? '' })
  );

  /** @param {OverlayKind} kind */
  function open(kind) {
    update((values) => (values.kind === kind ? values : { ...values, kind }));
  }

  /** @param {OverlayKind} kind */
  function toggle(kind) {
    update((values) => ({ ...values, kind: values.kind === kind ? null : kind }));
  }

  function close() {
    update((values) => (values.kind === null ? values : { ...values, kind: null }));
  }

  /** @param {string} q */
  function setQuery(q) {
    update((values) => (values.query === q ? values : { ...values, query: q }));
  }

  return { subscribe, open, toggle, close, setQuery };
}
