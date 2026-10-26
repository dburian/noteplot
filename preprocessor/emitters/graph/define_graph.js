import { logger } from '../../log.js';
import { bySlug } from '../../util.js';
import { fitViewBox, runLayout } from './layout.js';

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
 * @param {{
 *   id: string,
 *   deps: import('../../types.js').Field[] | '*',
 *   build: (corpus: import('../../corpus.js').Corpus) => {nodes: GraphNode[], links: GraphLink[]},
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
        return position ? { ...node, ...position, fx: position.x, fy: position.y } : { ...node };
      });

      const byId = new Map(nodes.map((node) => [node.slug, node]));
      const links = built.links
        .filter(({ source, target }) => byId.has(source) && byId.has(target))
        .map(({ source, target }) => ({ source: byId.get(source), target: byId.get(target) }));

      const unplaced = nodes.filter((node) => !('fx' in node)).length;
      let viewBox;
      if (unplaced > 0) {
        const full = unplaced == nodes.length;
        if (full) logger.info(`Laying out ${id} graph from scratch (${nodes.length} nodes).`);
        viewBox = await runLayout(layout, nodes, links, full ? null : 100);
      } else {
        // Nothing to place, but a removed node can still shrink the extent.
        viewBox = fitViewBox(nodes);
      }

      positions = new Map(nodes.map((node) => [node.slug, { x: node.x, y: node.y }]));

      await Promise.all([
        writer.write(`viz/${id}.json`, {
          viewBox,
          nodes: nodes.map(toSerialisableNode),
          // Slugs, not node objects: serialising the references embeds a full
          // copy of every node twice per link (ISSUES.md B1). `CanvasGraph`
          // rehydrates them against `nodes`.
          links: links.map(({ source, target }) => ({ source: source.slug, target: target.slug }))
        }),
        cache.writeJSON(cache.layoutFile(id), Object.fromEntries(positions))
      ]);
    }
  };
}
