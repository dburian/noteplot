import { defineGraphEmitter } from './define_graph.js';

/**
 * The tag graph: every note, plus one node per frontmatter tag, with an edge
 * from each note to each of its tags. Notes with no tags float free.
 *
 * A tag node's slug is `tag/<name>`. `toSlug` replaces every `/`, so no note
 * can have that slug, and the frontend's activation guard -- only notes open --
 * keys on exactly that. The tag node carries its own tag in `matter`, so the
 * force graph's tag glow colours it like the notes around it.
 */
export const createTagsGraphEmitter = () =>
  defineGraphEmitter({
    id: 'tags',
    deps: ['title', 'matter'],
    layout: 'notes',
    build(corpus) {
      const nodes = [];
      const links = [];
      const tags = new Set();
      for (const { slug, title, matter } of corpus.records.values()) {
        nodes.push({ slug, title, matter });
        for (const tag of tagsOf(matter)) {
          tags.add(tag);
          links.push({ source: slug, target: `tag/${tag}` });
        }
      }
      for (const tag of tags) {
        nodes.push({ slug: `tag/${tag}`, title: `#${tag}`, matter: { tags: [tag] }, kind: 'tag' });
      }
      return { nodes, links };
    }
  });

/**
 * `tags` as the force graph reads it, tolerating a scalar or junk -- this is
 * frontmatter, so it is whatever the author typed.
 *
 * @param {Record<string, any>} matter
 * @returns {string[]}
 */
function tagsOf(matter) {
  const tags = matter?.tags;
  if (Array.isArray(tags)) return tags.filter((tag) => typeof tag == 'string' && tag != '');
  if (typeof tags == 'string' && tags != '') return [tags];
  return [];
}
