import { parentPort, workerData } from 'node:worker_threads';

import { forceLayout } from './layout.js';
import { LAYOUTS } from './layouts.js';

/*
 * One full force layout, off the main thread. Started by `runLayout` with the
 * graph flattened to plain data, and gone once it has answered.
 */

const { layout, nodes, links, maxSteps } = workerData;
const linkObjects = links.map(([source, target]) => ({
  source: nodes[source],
  target: nodes[target]
}));

const viewBox = forceLayout(nodes, linkObjects, LAYOUTS[layout], maxSteps);

parentPort?.postMessage({ viewBox, positions: nodes.map(({ x, y }) => [x, y]) });
