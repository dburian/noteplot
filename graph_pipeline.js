import { saveJSON } from './note_preprocessor.js';
import { toSlug } from './unify_pipelines.js';
import path from 'path';
import * as d3 from 'd3';

// A graph with no nodes, or with every node at the same point, has no extent.
// The frontend divides by the viewBox's dimensions and sizes an array from them,
// so it must never be handed a zero -- or a `null`, which is what an empty
// collection used to produce because `updatePositions` never ran.
const MIN_VIEW_BOX_SIZE = 1;
const DEFAULT_VIEW_BOX = [0, 0, MIN_VIEW_BOX_SIZE, MIN_VIEW_BOX_SIZE];

// What `genD3Format` and the simulation add to a node on top of `toNode`'s
// shape. The velocities and the index are meaningless once the layout is
// frozen, and `fx`/`fy` are an input to the next run rather than something the
// frontend has any use for. Listed here rather than allow-listing the fields
// to keep, so `toNode` stays the single definition of a node's shape.
const TRANSIENT_NODE_KEYS = ['index', 'vx', 'vy', 'fx', 'fy'];

function toSerialisableNode(node) {
  const serialisable = { ...node };
  for (const key of TRANSIENT_NODE_KEYS) delete serialisable[key];
  return serialisable;
}

export class GraphPipeline {
  constructor(config) {
    this.config = config;

    this.nodes = new Map();
    this.links = new Map();
    this.positions = new Map();
    this.viewBox = [...DEFAULT_VIEW_BOX];
  }

  async on(events, previousResults) {
    const notes = previousResults.notes;
    const changes = previousResults.changes;

    const positionsToUpdate = new Set();
    for (const { eventType, targetPath } of events) {
      const slug = toSlug(targetPath, this.config.noteRoot);
      if (eventType == 'add') {
        this.addNote(notes.get(slug));
        positionsToUpdate.add(slug);
      } else if (eventType == 'change') {
        // TODO: Separate 'change' method
        const changedKeys = changes.get(slug);

        if (changedKeys.has('links')) {
          this.addNote(notes.get(slug));
          positionsToUpdate.add(slug);
        } else {
          // Only the keys a node actually has: `changedKeys` almost always
          // holds `content`, and copying that writes the note's entire
          // rendered HTML into `__graph.json` (ISSUES.md A4).
          const node = this.nodes.get(slug);
          for (const key of changedKeys) {
            if (key in node) node[key] = notes.get(slug)[key];
          }
        }
      } else if (eventType == 'unlink') {
        // The slug, not the note: `NotePipeline._deleteNote` has already dropped
        // it from `notes` by the time we get here.
        this.removeNote(slug);
      }
    }

    let { nodes, links, nodesWithoutPosition } = this.genD3Format();

    const nodesToUpdate = positionsToUpdate.union(nodesWithoutPosition);
    if (nodesToUpdate.size > 0) {
      // Relax everything only when nothing is pinned yet -- that is, on a cold
      // start. Testing `positionsToUpdate` here instead would spend the full
      // ~69k ticks on an entirely pinned graph whenever every note changes at
      // once within a live session.
      const maxSteps = nodesWithoutPosition.size == this.nodes.size ? null : 100;
      ({ nodes, links } = this.updatePositions(nodes, links, maxSteps));
    }

    const graph = {
      viewBox: this.viewBox,
      nodes: nodes.map(toSerialisableNode),
      // Slugs, not the node objects the simulation works with: serialising the
      // references embeds a full copy of every node twice per link
      // (ISSUES.md B1). `CanvasGraph` rehydrates them against `nodes`.
      links: links.map(({ source, target }) => ({
        source: source.slug,
        target: target.slug
      }))
    };

    await saveJSON(path.join(this.config.savePath, '__graph.json'), graph);

    return previousResults;
  }

  toNode(note) {
    return {
      title: note.title,
      slug: note.slug,
      matter: note.matter
    };
  }

  addNote(note) {
    this.nodes.set(note.slug, this.toNode(note));
    this.links.set(
      note.slug,
      note.links.map(({ slug }) => slug)
    );
  }

  removeNote(slug) {
    this.nodes.delete(slug);
    this.links.delete(slug);
    // Otherwise the map grows for the lifetime of the watch session. The cost
    // is that deleting a note and re-adding it relaxes it as a new node rather
    // than returning it to where it was.
    this.positions.delete(slug);
  }

  genD3Format() {
    const nodesWithoutPosition = new Set();
    const nodes = [];
    const slugToIdx = new Map();
    for (const [slug, node] of this.nodes.entries()) {
      const nodeIndex = nodes.length;
      slugToIdx.set(slug, nodeIndex);
      const position = this.positions.get(slug);
      if (!position) {
        nodesWithoutPosition.add(slug);
      }

      nodes.push({
        ...node,
        ...position,
        // Pinned, so a node that already has a position does not drift when
        // the simulation re-runs for a new neighbour (ISSUES.md A14). New
        // nodes stay free. Nothing is pinned on a cold start -- `positions`
        // only ever lives in memory -- so a restart re-lays the whole graph.
        ...(position && { fx: position.x, fy: position.y }),
        index: nodeIndex
      });
    }

    const links = [];
    for (const [fromSlug, targetSlugs] of this.links.entries()) {
      const fromIdx = slugToIdx.get(fromSlug);
      if (fromIdx === undefined) continue;

      for (const toSlug of targetSlugs) {
        const toIdx = slugToIdx.get(toSlug);
        if (toIdx === undefined) continue;

        links.push({
          source: nodes[fromIdx],
          target: nodes[toIdx]
        });
      }
    }

    return { nodes, links, slugToIdx, nodesWithoutPosition };
  }

  updatePositions(nodes, links, steps) {
    const {
      nodes: computedNodes,
      links: computedLinks,
      viewBox
    } = computeForceSimulation(nodes, links, {
      alphaDecay: 0.0001,
      // A `strength` on link, center and radial is a per-tick multiplier:
      // anything above 1 overshoots and amplifies, and the simulation reaches
      // NaN within ~100 ticks. The 60 and 1000 that used to sit here were
      // never applied (ISSUES.md A5) and each diverge on their own once they
      // are. `repel` is a many-body charge, not a multiplier, hence negative.
      //
      // Only the ratio of in-cluster spacing to between-cluster gaps matters:
      // `shrinkViewBox` fits the whole extent to the canvas, and the tag glow is
      // sized in screen pixels. `link.distance` sets the former; `radial`, a
      // linear pull to the origin, packs clusters until `repel` balances it.
      // `distanceMax` must exceed a cluster's width, or clusters stop pushing.
      forces: {
        link: { fn: d3.forceLink(links), strength: 0.7, distance: 10 },
        repel: { fn: d3.forceManyBody(), strength: -10, distanceMax: 150, distanceMin: 1 },
        center: { fn: d3.forceCenter(), strength: 1 },
        radial: { fn: d3.forceRadial(0, 0, 0), strength: 0.03 }
      },
      maxSteps: steps
    });

    for (const node of computedNodes) {
      this.positions.set(node.slug, { x: node.x, y: node.y });
    }
    this.viewBox = viewBox;

    return { nodes: computedNodes, links: computedLinks };
  }
}

function computeForceSimulation(nodes, links, config) {
  let simulation = d3.forceSimulation(nodes).alphaDecay(config.alphaDecay).stop();

  for (const name in config.forces) {
    const settings = config.forces[name];
    let force = settings.fn;
    if ('strength' in settings) force = force.strength(settings.strength);
    if ('distanceMax' in settings) force = force.distanceMax(settings.distanceMax);
    if ('distanceMin' in settings) force = force.distanceMin(settings.distanceMin);
    if ('distance' in settings) force = force.distance(settings.distance);

    simulation = simulation.force(name, force);
  }

  let numberOfTicksTillEnd = Math.ceil(
    Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
  );

  if (config.maxSteps) {
    numberOfTicksTillEnd = Math.min(config.maxSteps, numberOfTicksTillEnd);
  }

  simulation.tick(numberOfTicksTillEnd);

  return shrinkViewBox(nodes, links);
}

function shrinkViewBox(nodes, links) {
  if (nodes.length == 0) {
    return { nodes, links, viewBox: [...DEFAULT_VIEW_BOX] };
  }

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minY = Math.min(node.y, minY);
    maxY = Math.max(node.y, maxY);
    minX = Math.min(node.x, minX);
    maxX = Math.max(node.x, maxX);
  }

  // In place: these nodes are rebuilt by `genD3Format` on every run, and the
  // links already point at these very objects. Copying them is what put two
  // full node copies per link into `__graph.json` (ISSUES.md B1), and it is
  // why moving a node would not have moved its links. It leaves `fx`/`fy`
  // untranslated, which is harmless -- they are dropped on the way out and
  // rebuilt from `this.positions`, which stores the translated coordinates.
  for (const node of nodes) {
    node.x -= minX;
    node.y -= minY;
  }

  // Floored: a single node, or a row of collinear ones, collapses an axis to 0.
  const width = Math.max(maxX - minX, MIN_VIEW_BOX_SIZE);
  const height = Math.max(maxY - minY, MIN_VIEW_BOX_SIZE);
  const paddingFr = 0.1;
  const newViewBox = [
    (-width * paddingFr) / 2, // min x
    (-height * paddingFr) / 2, // min y
    width + width * paddingFr, // width
    height + height * paddingFr // height
  ];

  return { nodes, links, viewBox: newViewBox };
}
