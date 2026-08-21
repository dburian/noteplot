import { writable } from 'svelte/store';

/**
 * @typedef {{id: string, slug: string}} Tile
 * @typedef {{tiles: Tile[], focusIndex: number}} TilesState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<TilesState>['subscribe'],
 *   open: (slug: string, opts?: {where?: 'focused'|'new'}) => void,
 *   splitRight: () => void,
 *   close: (id: string) => void,
 *   focus: (index: number) => void,
 *   setSlugAt: (index: number, slug: string) => void,
 *   reconcile: (slugs: string[], focusIndex: number) => void,
 * }} TilesStore
 */

/**
 * Tile ids are stable, monotonic and *not* random: they key the `{#each}` and
 * the scroll-position memory, so `Math.random()` or `Date.now()` here would
 * quietly break scroll restoration. A module-level counter is enough — ids
 * only have to be unique within one page load, which is also the lifetime of
 * the scroll memory.
 */
let nextId = 0;

/** @param {string} slug @returns {Tile} */
function makeTile(slug) {
  return { id: `t${nextId++}`, slug };
}

/**
 * The content area's columns. Zero tiles is a legal state and means "no note
 * open" — the bare-visualization `/` route. It is not an error case; the
 * content pane renders an empty state for it.
 *
 * @param {{slugs?: string[], focusIndex?: number}} [initial]
 * @returns {TilesStore}
 */
export function createTilesState(initial = {}) {
  const startTiles = (initial.slugs ?? []).map(makeTile);
  const { subscribe, update } = writable(
    /** @type {TilesState} */ ({
      tiles: startTiles,
      focusIndex: clampIndex(initial.focusIndex ?? 0, startTiles.length)
    })
  );

  /**
   * `open` is the one entry point every navigation source funnels through —
   * a canvas click, a search result, a prose link, a history chip.
   *
   * @param {string} slug
   * @param {{where?: 'focused'|'new'}} [opts]
   */
  function open(slug, opts = {}) {
    const where = opts.where ?? 'focused';
    update((values) => {
      if (values.tiles.length === 0) {
        return { tiles: [makeTile(slug)], focusIndex: 0 };
      }
      if (where === 'new') {
        const at = values.focusIndex + 1;
        const tiles = [...values.tiles];
        tiles.splice(at, 0, makeTile(slug));
        return { tiles, focusIndex: at };
      }
      const focused = values.tiles[values.focusIndex];
      if (focused.slug === slug) return values;
      const tiles = [...values.tiles];
      tiles[values.focusIndex] = { ...focused, slug };
      return { ...values, tiles };
    });
  }

  /**
   * Duplicate the focused tile into a new column to its right.
   *
   * A no-op with no tiles open. There is nothing to split, and the alternative
   * — minting a tile with an empty slug — would push a "no note here" state
   * into every consumer that renders a tile, to describe a situation the empty
   * state already covers.
   */
  function splitRight() {
    update((values) => {
      const focused = values.tiles[values.focusIndex];
      if (!focused) return values;
      const at = values.focusIndex + 1;
      const tiles = [...values.tiles];
      tiles.splice(at, 0, makeTile(focused.slug));
      return { tiles, focusIndex: at };
    });
  }

  /** @param {string} id */
  function close(id) {
    update((values) => {
      const at = values.tiles.findIndex((t) => t.id === id);
      if (at < 0) return values;
      const tiles = values.tiles.filter((t) => t.id !== id);
      // Focus the tile that slid into the closed one's place, or the new last
      // one if it was the rightmost.
      const focusIndex = clampIndex(
        values.focusIndex > at ? values.focusIndex - 1 : values.focusIndex,
        tiles.length
      );
      return { tiles, focusIndex };
    });
  }

  /** @param {number} index */
  function focus(index) {
    update((values) => {
      const next = clampIndex(index, values.tiles.length);
      return next === values.focusIndex ? values : { ...values, focusIndex: next };
    });
  }

  /** @param {number} index @param {string} slug */
  function setSlugAt(index, slug) {
    update((values) => {
      const tile = values.tiles[index];
      if (!tile || tile.slug === slug) return values;
      const tiles = [...values.tiles];
      tiles[index] = { ...tile, slug };
      return { ...values, tiles };
    });
  }

  /**
   * Apply a tile list that came back from the URL (on popstate, or on a
   * navigation this store did not initiate).
   *
   * This *reconciles* rather than rebuilds: a tile whose slug already matches
   * at that position keeps its existing `id`. Minting fresh ids on every
   * navigation would invalidate the scroll memory — which is keyed by tile id
   * — on exactly the back/forward presses it exists to serve.
   *
   * @param {string[]} slugs
   * @param {number} focusIndex
   */
  function reconcile(slugs, focusIndex) {
    update((values) => {
      const same =
        values.tiles.length === slugs.length &&
        values.tiles.every((t, i) => t.slug === slugs[i]) &&
        values.focusIndex === clampIndex(focusIndex, slugs.length);
      if (same) return values;

      const tiles = slugs.map((slug, i) => {
        const existing = values.tiles[i];
        return existing && existing.slug === slug ? existing : makeTile(slug);
      });
      return { tiles, focusIndex: clampIndex(focusIndex, tiles.length) };
    });
  }

  return { subscribe, open, splitRight, close, focus, setSlugAt, reconcile };
}

/** @param {number} index @param {number} length */
function clampIndex(index, length) {
  if (length === 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}
