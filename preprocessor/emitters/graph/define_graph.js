import { logger } from '../../log.js';
import { bySlug } from '../../util.js';
import { fitViewBox, runLayout } from './layout.js';
import { LAYOUTS } from './layouts.js';

// What the simulation adds to a node on top of what `build` returned. The
// velocities and the index are meaningless once the layout is frozen, and
// `fx`/`fy` are an input to the next run rather than anything the frontend uses.
const TRANSIENT_NODE_KEYS = ['index', 'vx', 'vy', 'fx', 'fy'];

/** @param {Record<string, any>} node */
function toSerialisableNode(node) {
  const serialisable = { ...node };
  for (const key of TRANSIENT_NODE_KEYS) delete serialisable[key];
  return serialisable;
}

/**
 * @typedef {{slug: string, title: string, [key: string]: any}} GraphNode
 *
 * `slug` is the node's identity -- the frontend keys nodes, links, hover and
 * activation on it. A node that is not a note must use an id `toSlug` can never
 * produce; anything containing `/` qualifies, since `/` is always the separator
 * `toSlug` replaces.
 *
 * @typedef {{source: string, target: string}} GraphLink
 */

/**
 * Makes an emitter that writes one force-laid-out graph to `viz/<id>.json`, in
 * the `{viewBox, nodes, links}` shape `ForceGraphView` renders. A new graph is
 * a `build` function from the corpus to nodes and links; positions, caching and
 * output are handled here.
 *
 * **Positions persist** in the cache, per note root. A node that has one is pinned there; only
 * nodes without one are relaxed, for 100 ticks among the pinned (ISSUES.md
 * A14). The full relaxation -- tens of thousands of ticks, the slowest thing
 * the preprocessor does -- runs only when no node has a position at all: the
 * first run, or after the cache is deleted.
 *
 * **`build` may pin a node's x** by returning it with `fx` set -- the date
 * graph pins each note to its date. That pin always wins; the persisted y is
 * reused only while the persisted x still equals it, so a note whose date moved
 * is relaxed again at its new x. Such a layout must not translate (see
 * `LayoutParams.translate`), or the stored x would never match.
 *
 * `extra` is spread into the output next to `viewBox`, `nodes` and `links`,
 * which it must not name -- the date graph's `timeAxis` travels this way.
 *
 * @param {{
 *   id: string,
 *   deps: import('../../types.js').Field[] | '*',
 *   build: (corpus: import('../../corpus.js').Corpus) => {nodes: GraphNode[], links: GraphLink[], extra?: Record<string, unknown>},
 *   layout: keyof typeof import('./layouts.js').LAYOUTS,
 * }} spec
 * @returns {import('../../types.js').Emitter}
 */
export function defineGraphEmitter({ id, deps, build, layout }) {
  /** slug → position, translated into the last viewBox. @type {Map<string, {x: number, y: number}> | null} */
  let positions = null;

  return {
    id: `graph:${id}`,
    deps,

    async emit(corpus, changes, { writer, cache }) {
      positions ??= new Map(Object.entries((await cache.readJSON(cache.layoutFile(id))) ?? {}));

      const built = build(corpus);
      const nodes = bySlug(built.nodes).map((node) => {
        const position = positions?.get(node.slug);
        if (typeof node.fx == 'number') {
          const pinned = { ...node, x: node.fx };
          return position?.x === node.fx ? { ...pinned, y: position.y, fy: position.y } : pinned;
        }
        return position ? { ...node, ...position, fx: position.x, fy: position.y } : { ...node };
      });

      const byId = new Map(nodes.map((node) => [node.slug, node]));
      const links = built.links
        .filter(({ source, target }) => byId.has(source) && byId.has(target))
        .map(({ source, target }) => ({ source: byId.get(source), target: byId.get(target) }));

      const unplaced = nodes.filter((node) => !('fy' in node)).length;
      let viewBox;
      if (unplaced > 0) {
        const full = unplaced == nodes.length;
        if (full) logger.info(`Laying out ${id} graph from scratch (${nodes.length} nodes).`);
        else seedPinnedNodes(nodes, links);
        viewBox = await runLayout(layout, nodes, links, full ? null : 100);
      } else {
        // Nothing to place, but a removed node can still shrink the extent.
        viewBox = fitViewBox(nodes, { translate: LAYOUTS[layout].translate ?? true });
      }

      positions = new Map(nodes.map((node) => [node.slug, { x: node.x, y: node.y }]));

      await Promise.all([
        writer.write(`viz/${id}.json`, {
          viewBox,
          nodes: nodes.map(toSerialisableNode),
          // Slugs, not node objects: serialising the references embeds a full
          // copy of every node twice per link (ISSUES.md B1). `CanvasGraph`
          // rehydrates them against `nodes`.
          links: links.map(({ source, target }) => ({ source: source.slug, target: target.slug })),
          ...built.extra
        }),
        cache.writeJSON(cache.layoutFile(id), Object.fromEntries(positions))
      ]);
    }
  };
}

/**
 * Starts each build-pinned node that has no y yet at the mean y of its placed
 * neighbours, or at 0. Left to d3, it would start on the phyllotaxis spiral,
 * possibly far from everything, and the 100 ticks of an incremental run would
 * not bring it back. Nodes without a build pin keep d3's start.
 *
 * @param {Record<string, any>[]} nodes
 * @param {{source: Record<string, any>, target: Record<string, any>}[]} links
 */
function seedPinnedNodes(nodes, links) {
  for (const node of nodes) {
    if (!('fx' in node) || 'fy' in node) continue;
    const ys = links
      .map(({ source, target }) => (source == node ? target : target == node ? source : null))
      .filter((other) => other && 'fy' in other)
      .map((other) => other.y);
    node.y = ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
  }
}
