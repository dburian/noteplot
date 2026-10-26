import * as d3 from 'd3';

/**
 * The date graph's horizontal scale: graph units per day. A node is drawn at a
 * fixed size in screen pixels, so this only sets how wide time is relative to
 * the vertical spread the forces produce.
 */
export const UNITS_PER_DAY = 10;

/** Just over half a day: two notes from one day stack, neighbouring days barely touch. */
const DATE_COLLIDE_RADIUS = 5.5;

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
  // x is pinned to the date by the emitter, so only y moves: no centre or radial
  // force (they would do nothing), and far fewer ticks than `notes` needs.
  // `collide` keeps same-day notes apart, `repel` spreads notes close in time
  // vertically so their links are not drawn on top of each other, `link` pulls
  // linked notes into the same band and `y` keeps the strip near the axis.
  date: {
    alphaDecay: 0.01,
    // x is absolute time (see `emitters/graph/dates.js`); moving it would
    // break the `timeAxis` mapping and the persisted-position check.
    translate: false,
    forces: (links) => ({
      link: { fn: d3.forceLink(links), strength: 0.2, distance: 20 },
      collide: { fn: d3.forceCollide(DATE_COLLIDE_RADIUS).iterations(2), strength: 1 },
      repel: { fn: d3.forceManyBody(), strength: -15, distanceMax: 60, distanceMin: 1 },
      y: { fn: d3.forceY(0), strength: 0.03 }
    })
  }
};
