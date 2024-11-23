import { saveJSON } from "./note_preprocessor.js"
import { toSlug } from "./unify_pipelines.js"
import path from 'path';
import * as d3 from "d3";

export class GraphPipeline {
  constructor(config) {
    this.config = config

    this.nodes = new Map()
    this.links = new Map()
    this.positions = new Map()
    this.viewBox = null
  }

  async on(events, previousResults) {
    const notes = previousResults.notes
    const changes = previousResults.changes

    const positionsToUpdate = new Set()
    for (const { eventType, targetPath } of events) {
      const slug = toSlug(targetPath, this.config.noteRoot)
      if (eventType == 'add') {
        this.addNote(notes.get(slug))
        positionsToUpdate.add(slug)
      } else if (eventType == 'change') {
        // TODO: Separate 'change' method
        const changedKeys = changes.get(slug)

        if (changedKeys.has('links')) {
          this.addNote(notes.get(slug))
          positionsToUpdate.add(slug)
        } else {
          for (const key of changedKeys) {
            this.nodes.get(slug)[key] = notes.get(slug)[key]
          }
        }
      } else if (eventType == 'unlink') {
        this.removeNote(notes.get(slug))
      }
    }

    let { nodes, links, nodesWithoutPosition } = this.genD3Format(positionsToUpdate)

    const nodesToUpdate = positionsToUpdate.union(nodesWithoutPosition)
    if (nodesToUpdate.size > 0) {
      const maxSteps = positionsToUpdate.size == this.nodes.size ? null : 100;
      ({ nodes, links } = this.updatePositions(nodes, links, maxSteps))
    }

    const graph = {
      viewBox: this.viewBox,
      nodes,
      links,
    }

    await saveJSON(path.join(this.config.savePath, '__graph.json'), graph)

    return previousResults
  }

  toNode(note) {
    return {
      title: note.title,
      slug: note.slug,
      matter: note.matter,
    }
  }

  addNote(note) {
    this.nodes.set(note.slug, this.toNode(note))
    this.links.set(note.slug, note.links.map(({ slug }) => slug))
  }

  removeNote(note) {
    this.nodes.delete(note.slug)
    this.links.delete(note.slug)
  }

  genD3Format(slugsToUpdate) {
    const nodesWithoutPosition = new Set()
    const nodes = []
    const slugToIdx = new Map()
    for (const [slug, node] of this.nodes.entries()) {
      const nodeIndex = nodes.length
      slugToIdx.set(slug, nodeIndex)
      let position = this.positions.get(slug)
      if (!position) {
        nodesWithoutPosition.add(slug)
      }

      if (position && !slugsToUpdate.has(slug)) {
        position.fx = position.x
        position.fy = position.y
      }

      nodes.push({
        ...node,
        ...position,
        index: nodeIndex,
      })
    }

    const links = []
    for (const [fromSlug, targetSlugs] of this.links.entries()) {
      const fromIdx = slugToIdx.get(fromSlug)
      if (!fromIdx) continue

      for (const toSlug of targetSlugs) {
        const toIdx = slugToIdx.get(toSlug)
        if (!toIdx) continue

        links.push({
          source: nodes[fromIdx],
          target: nodes[toIdx]
        })
      }
    }

    return { nodes, links, slugToIdx, nodesWithoutPosition }
  }

  updatePositions(nodes, links, steps) {
    const { nodes: computedNodes, links: computedLinks, viewBox } = computeForceSimulation(nodes, links, {
      alphaDecay: 0.0001,
      forces: {
        link: { fn: d3.forceLink(links), strength: 60, distance: 0.1 },
        repel: { fn: d3.forceManyBody(), strength: -20, distanceMax: 60, distanceMin: 0 },
        center: { fn: d3.forceCenter(), strength: 1000 },
        radial: { fn: d3.forceRadial(0.001, 0, 0), strength: 0.001 },
      },
      maxSteps: steps,
    })

    for (const node of computedNodes) {
      this.positions.set(node.slug, { x: node.x, y: node.y })
    }

    this.viewBox = viewBox

    return { nodes: computedNodes, links: computedLinks }
  }
}



function computeForceSimulation(nodes, links, config) {
  let simulation = d3.forceSimulation(nodes)
    .alphaDecay(config.alphaDecay)
    .stop()

  for (const name in config.forces) {
    const settings = config.forces[name]
    let force = settings.fn
    if ('force' in settings) force = force.strength(settings.strength)
    if ('distanceMax' in settings) force = force.distanceMax(settings.distanceMax)
    if ('distanceMin' in settings) force = force.distanceMin(settings.distanceMin)
    if ('distance' in settings) force = force.distance(settings.distance)

    simulation = simulation.force(name, force)
  }

  let numberOfTicksTillEnd = Math.ceil(
    Math.log(simulation.alphaMin()) /
    Math.log(1 - simulation.alphaDecay())
  )

  if (config.maxSteps) {
    numberOfTicksTillEnd = Math.min(config.maxSteps, numberOfTicksTillEnd)
  }

  simulation.tick(numberOfTicksTillEnd);

  return shrinkViewBox(nodes, links)
}

function shrinkViewBox(nodes, links) {
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

  const moveNode = (node) => ({ ...node, x: node.x - minX, y: node.y - minY })
  nodes = nodes.map(moveNode);
  links = links.map(link => ({
    ...link,
    source: moveNode(link.source),
    target: moveNode(link.target)
  }));


  const width = maxX - minX;
  const height = maxY - minY;
  const paddingFr = 0.1
  const newViewBox = [
    -width * paddingFr / 2, // min x
    -height * paddingFr / 2, // min y
    width + width * paddingFr, // width
    height + height * paddingFr // height
  ];

  return { nodes, links, viewBox: newViewBox };
}
