import { forceGraph } from './force_graph/index.js';
import { tagGraph } from './tag_graph/index.js';

/**
 * The visualization registry — the enumeration the toolbar's switcher lists and
 * `VizPane` renders from.
 *
 * A visualization is one entry in this array and nothing else: adding a second
 * one is writing a directory next to `force_graph/` and pushing its descriptor
 * here. Nothing in the shell, the toolbar or the state layer names a
 * visualization.
 *
 * `View` and `Controls` are still typed `any` and consumers still guard on
 * them, because a descriptor is allowed to contribute no toolbar controls at
 * all — `VizSection` guards its `<svelte:component>` on `Controls`, `VizPane`
 * on `View`.
 *
 * The state layer never imports this file. `createVizState` takes the
 * descriptor list as an argument (`(app)/+layout.svelte` passes it in), so the
 * stores stay independent of the visualization layer.
 *
 * @typedef {Object} Visualization
 * @property {string} id stable; the settings key, and what is persisted to localStorage
 * @property {string} label shown in the toolbar switcher
 * @property {string | null} dataId which `src/lib/generated/viz/<dataId>.json` the
 *   View is handed as `data` -- the id of the preprocessor emitter that writes
 *   it. `null` for a visualization that needs no generated data.
 * @property {any} View Svelte component; props `{data, settings, callbacks}`
 * @property {any} Controls Svelte component rendered into the toolbar; no props, may be null
 * @property {Record<string, unknown>} defaultSettings
 */

/** @type {Visualization[]} */
export const visualizations = [forceGraph, tagGraph];

/**
 * Falls back to the first entry rather than returning `undefined`. `viz.activeId`
 * can name a visualization that no longer exists — it is restored from
 * localStorage, which outlives any rename — and every caller of this reads
 * `.label` or `.View` off the result straight away.
 *
 * @param {string} id
 * @returns {Visualization}
 */
export function getVisualization(id) {
  return visualizations.find((v) => v.id === id) ?? visualizations[0];
}
