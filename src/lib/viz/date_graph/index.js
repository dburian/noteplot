import ForceGraphView from '../force_graph/ForceGraphView.svelte';
import ForceGraphControls from '../force_graph/ForceGraphControls.svelte';

/**
 * Every note, left to right by creation date, drawn by the force graph's
 * renderer.
 *
 * A descriptor only, like `tag_graph/`: the preprocessor's
 * `emitters/graph/dates.js` pins each note's x to its date and lays out only y,
 * and writes a `timeAxis` into `viz/dates.json`. That key is what turns on the
 * renderer's date ticks, and a node's `dateSource: 'mtime'` is what draws it
 * dimmed -- its note had no usable `created` date, so its file's mtime stands in.
 *
 * Connections are off by default: links between notes far apart in time cross
 * the whole strip. The hovered and the selected note still show theirs.
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
