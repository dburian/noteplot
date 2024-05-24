import * as d3 from "d3";

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

  const moveNode = (node) => ({...node, x: node.x - minX, y: node.y - minY})
  nodes = nodes.map(moveNode);
  links = links.map(link => ({
    ...link,
    source: moveNode(link.source),
    target: moveNode(link.target)
  }));


  const newViewBox = [0, 0, maxX - minX, maxY - minY];
  return {nodes, links, viewBox: newViewBox};
}

export function computeForceSimulation(nodes, links) {
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).strength(1))
    .force("charge", d3.forceManyBody().distanceMax(100))
    .force("center", d3.forceCenter())
    .stop()

  const numberOfTicksTillEnd = Math.ceil(
    Math.log(simulation.alphaMin()) /
      Math.log(1 - simulation.alphaDecay())
  )
  for (let i = 0; i < numberOfTicksTillEnd; ++i) {
    simulation.tick();
  }

  return shrinkViewBox(nodes, links)
}

