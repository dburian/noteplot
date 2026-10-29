import * as d3 from 'd3';

/**
 * The date graph's scale, on both axes: graph units per day. A node is drawn at
 * a fixed size in screen pixels, so this only sets how far apart days are
 * relative to a node.
 */
export const UNITS_PER_DAY = 10;

/**
 * Every named force layout a graph emitter may ask for.
 *
 * By name rather than by value because a full layout runs in a worker thread,
 * and a layout's `forces` factory is a function -- it cannot be posted to one.
 * The worker imports this module and looks the name up.
 *
 * @type {Record<string, import('./layout.js').LayoutParams>}
 */
export const LAYOUTS = {
  notes: {
    alphaDecay: 0.0001,
    // A `strength` on link, center and radial is a per-tick multiplier:
    // anything above 1 overshoots and amplifies, and the simulation reaches NaN
    // within ~100 ticks. The 60 and 1000 that used to sit here were never
    // applied (ISSUES.md A5) and each diverge on their own once they are.
    // `repel` is a many-body charge, not a multiplier, hence negative.
    //
    // Only the ratio of in-cluster spacing to between-cluster gaps matters: the
    // viewBox is fitted to the whole extent, and the tag glow is sized in
    // screen pixels. `link.distance` sets the former; `radial`, a linear pull
    // to the origin, packs clusters until `repel` balances it. `distanceMax`
    // must exceed a cluster's width, or clusters stop pushing.
    forces: (links) => ({
      link: { fn: d3.forceLink(links), strength: 0.7, distance: 10 },
      repel: { fn: d3.forceManyBody(), strength: -10, distanceMax: 150, distanceMin: 1 },
      center: { fn: d3.forceCenter(), strength: 1 },
      radial: { fn: d3.forceRadial(0, 0, 0), strength: 0.03 }
    })
  },
  // The emitter pins both coordinates (see `emitters/graph/dates.js`), so
  // nothing is laid out: the layout is never run, and has no forces in case it
  // ever is. It is here for `translate`.
  date: {
    alphaDecay: 0.01,
    // Both coordinates are absolute time; moving them would break `timeAxes`.
    translate: false,
    forces: () => ({})
  }
};
