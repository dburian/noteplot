import ForceGraphView from '../force_graph/ForceGraphView.svelte';
import ForceGraphControls from '../force_graph/ForceGraphControls.svelte';

/**
 * Every note on a created × accessed grid -- left to right by creation date,
 * bottom to top by the last time it was edited -- drawn by the force graph's
 * renderer.
 *
 * A descriptor only, like `tag_graph/`: the preprocessor's
 * `emitters/graph/dates.js` pins both of each note's coordinates to its dates,
 * and writes `timeAxes` into `viz/dates.json`. That key is what turns on the
 * renderer's date ticks along both edges and the created = accessed diagonal,
 * and a node's `dateSource: 'fs'` is what draws it dimmed -- git does not track
 * its note, so filesystem times stand in.
 *
 * Connections are off by default: links between notes far apart in time cross
 * the whole grid. The hovered and the selected note still show theirs.
 *
 * @type {import('../registry.js').Visualization}
 */
export const dateGraph = {
  id: 'date-graph',
  label: 'Date graph',
  dataId: 'dates',
  View: ForceGraphView,
  Controls: ForceGraphControls,
  defaultSettings: { showConnections: false, showTagsGlow: true }
};

export default dateGraph;
