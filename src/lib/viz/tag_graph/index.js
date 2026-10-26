import ForceGraphView from '../force_graph/ForceGraphView.svelte';
import ForceGraphControls from '../force_graph/ForceGraphControls.svelte';

/**
 * Notes and the tags they carry, drawn by the force graph's renderer.
 *
 * Nothing here but a descriptor: the graph itself is built by the
 * preprocessor's `emitters/graph/tags.js`, which writes `viz/tags.json` in the
 * same `{viewBox, nodes, links}` shape the force graph renders. Its tag nodes
 * have slugs no note can have (`tag/<name>`), and `VizPane` opens only nodes
 * that are notes, so clicking a tag does nothing rather than opening a 404.
 *
 * Settings are its own (`id` keys them), so toggling connections here does not
 * toggle them on the link graph.
 *
 * @type {import('../registry.js').Visualization}
 */
export const tagGraph = {
  id: 'tag-graph',
  label: 'Tag graph',
  dataId: 'tags',
  View: ForceGraphView,
  Controls: ForceGraphControls,
  defaultSettings: { showConnections: true, showTagsGlow: true }
};

export default tagGraph;
