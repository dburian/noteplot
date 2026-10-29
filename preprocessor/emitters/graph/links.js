import { defineGraphEmitter } from './define_graph.js';

/**
 * The link graph: one node per note, one edge per Markdown link between two
 * notes that exist. What the `force-graph` visualization renders.
 */
export const createLinksGraphEmitter = () =>
  defineGraphEmitter({
    id: 'links',
    deps: ['title', 'matter', 'linkSlugs'],
    layout: 'notes',
    build(corpus) {
      const nodes = [];
      const links = [];
      for (const { slug, title, matter, linkSlugs } of corpus.records.values()) {
        nodes.push({ slug, title, matter });
        for (const target of linkSlugs) links.push({ source: slug, target });
      }
      return { nodes, links };
    }
  });
