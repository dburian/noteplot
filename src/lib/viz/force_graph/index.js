import ForceGraphView from './ForceGraphView.svelte';
import ForceGraphControls from './ForceGraphControls.svelte';

/**
 * The force graph as the registry sees it. Everything the rest of the app knows
 * about this visualization goes through this object — `registry.js` imports
 * nothing else out of `force_graph/`.
 *
 * `defaultSettings` is the **only** definition of these defaults.
 * `createVizState` is handed the descriptor list and reads them from here, so
 * there is no second copy in `state/` to drift.
 *
 * @type {import('../registry.js').Visualization}
 */
export const forceGraph = {
  id: 'force-graph',
  label: 'Force graph',
  dataId: 'links',
  View: ForceGraphView,
  Controls: ForceGraphControls,
  defaultSettings: { showConnections: true, showTagsGlow: true }
};

export default forceGraph;
