import * as d3 from 'd3';
import { Worker } from 'node:worker_threads';

import { LAYOUTS } from './layouts.js';

// A graph with no nodes, or with every node at the same point, has no extent.
// The frontend divides by the viewBox's dimensions and sizes an array from them,
// so it must never be handed a zero -- or a `null`, which is what an empty
// collection used to produce.
const MIN_VIEW_BOX_SIZE = 1;
export const DEFAULT_VIEW_BOX = [0, 0, MIN_VIEW_BOX_SIZE, MIN_VIEW_BOX_SIZE];

/**
 * @typedef {{
 *   alphaDecay: number,
 *   translate?: boolean,
 *   forces: (links: any[]) => Record<string, ForceSettings>,
 * }} LayoutParams
 *
 * `forces` is a factory because `d3.forceLink` has to be handed the link array
 * of the run it is part of. `translate: false` keeps the coordinates the
 * layout produced instead of moving the bounding box to the origin -- for a
 * graph whose x means something, like the date graph's time axis.
 *
 * @typedef {{
 *   fn: any,
 *   strength?: number,
 *   distance?: number,
 *   distanceMin?: number,
 *   distanceMax?: number,
 * }} ForceSettings
 */

/**
 * Lays `nodes` out in place with the named layout and returns the viewBox.
 *
 * A full layout (`maxSteps` null) runs in a worker thread. It is tens of
 * thousands of ticks -- seconds per graph -- and on the main thread it ran the
 * graphs one after another, and in `watch` froze the vite dev server that
 * shares the process. A capped run is a few milliseconds and stays inline.
 *
 * @param {string} layout a key of `LAYOUTS`
 * @param {{x?: number, y?: number, fx?: number, fy?: number}[]} nodes
 * @param {{source: any, target: any}[]} links node objects from `nodes`
 * @param {number | null} maxSteps
 * @returns {Promise<number[]>}
 */
export async function runLayout(layout, nodes, links, maxSteps) {
  if (maxSteps !== null) return forceLayout(nodes, links, LAYOUTS[layout], maxSteps);

  const index = new Map(nodes.map((node, i) => [node, i]));
  const { viewBox, positions } = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./layout_worker.js', import.meta.url), {
      workerData: {
        layout,
        maxSteps,
        nodes: nodes.map(({ x, y, fx, fy }) => ({ x, y, fx, fy })),
        links: links.map(({ source, target }) => [index.get(source), index.get(target)])
      }
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => reject(new Error(`Layout worker exited with ${code}.`)));
  });

  positions.forEach(([x, y], i) => Object.assign(nodes[i], { x, y }));
  return viewBox;
}

/**
 * Lays `nodes` out in place with a d3 force simulation, then translates them so
 * their bounding box starts at the origin.
 *
 * A node carrying `fx`/`fy` is pinned there. `maxSteps` caps the run; `null`
 * runs until alpha decays to `alphaMin`, which with a small `alphaDecay` is tens
 * of thousands of ticks -- by far the slowest thing the preprocessor does, and
 * the reason positions are persisted between runs.
 *
 * @param {any[]} nodes
 * @param {{source: any, target: any}[]} links node objects, not ids
 * @param {LayoutParams} params
 * @param {number | null} maxSteps
 * @returns {number[]} the viewBox
 */
export function forceLayout(nodes, links, params, maxSteps) {
  let simulation = d3.forceSimulation(nodes).alphaDecay(params.alphaDecay).stop();

  const forces = params.forces(links);
  for (const name in forces) {
    const settings = forces[name];
    let force = settings.fn;
    if ('strength' in settings) force = force.strength(settings.strength);
    if ('distanceMax' in settings) force = force.distanceMax(settings.distanceMax);
    if ('distanceMin' in settings) force = force.distanceMin(settings.distanceMin);
    if ('distance' in settings) force = force.distance(settings.distance);

    simulation = simulation.force(name, force);
  }

  let ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  if (maxSteps !== null) ticks = Math.min(maxSteps, ticks);

  simulation.tick(ticks);

  return fitViewBox(nodes, { translate: params.translate ?? true });
}

/**
 * Translates `nodes` in place so their bounding box starts at the origin, and
 * returns a viewBox around it with 10% padding. With `translate: false` the
 * nodes stay put and the viewBox is fitted around them where they are.
 *
 * In place because links point at these very objects. It leaves `fx`/`fy`
 * untranslated, which is harmless -- they are dropped on the way out and
 * rebuilt from the stored positions, which are the translated ones.
 *
 * @param {{x: number, y: number}[]} nodes
 * @param {{translate?: boolean}} [options]
 * @returns {number[]}
 */
export function fitViewBox(nodes, { translate = true } = {}) {
  if (nodes.length == 0) return [...DEFAULT_VIEW_BOX];

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

  if (translate) {
    for (const node of nodes) {
      node.x -= minX;
      node.y -= minY;
    }
  }
  const originX = translate ? 0 : minX;
  const originY = translate ? 0 : minY;

  // Floored: a single node, or a row of collinear ones, collapses an axis to 0.
  const width = Math.max(maxX - minX, MIN_VIEW_BOX_SIZE);
  const height = Math.max(maxY - minY, MIN_VIEW_BOX_SIZE);
  const paddingFr = 0.1;
  return [
    originX - (width * paddingFr) / 2, // min x
    originY - (height * paddingFr) / 2, // min y
    width + width * paddingFr, // width
    height + height * paddingFr // height
  ];
}
