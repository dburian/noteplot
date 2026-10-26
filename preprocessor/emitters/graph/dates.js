import { defineGraphEmitter } from './define_graph.js';
import { UNITS_PER_DAY } from './layouts.js';

const MS_PER_DAY = 86_400_000;
const MS_PER_UNIT = MS_PER_DAY / UNITS_PER_DAY;

/**
 * The date graph: one node per note, pinned left to right by creation date,
 * with the link graph's edges. Only y is laid out (the `date` layout).
 *
 * The date is the frontmatter's `created`; a note without a usable one falls
 * back to its file's mtime -- the parse has already warned -- and carries
 * `dateSource: 'mtime'` so the renderer can draw it as the guess it is.
 *
 * x is absolute: `ms / msPerUnit`, with the epoch at 0. The output's
 * `timeAxis` is that mapping, for the renderer's date ticks. Nothing about it
 * depends on the collection, so adding an older note moves nothing else.
 */
export const createDateGraphEmitter = () =>
  defineGraphEmitter({
    id: 'dates',
    deps: ['title', 'matter', 'linkSlugs', 'created', 'mtimeMs'],
    layout: 'date',
    build(corpus) {
      const nodes = [];
      const links = [];
      for (const { slug, title, matter, linkSlugs, created, mtimeMs } of corpus.records.values()) {
        const fromMatter = created !== null;
        const ms = fromMatter ? created : localDay(mtimeMs ?? 0);
        nodes.push({
          slug,
          title,
          matter,
          dateSource: fromMatter ? 'matter' : 'mtime',
          fx: ms / MS_PER_UNIT
        });
        for (const target of linkSlugs) links.push({ source: slug, target });
      }
      return { nodes, links, extra: { timeAxis: { originMs: 0, msPerUnit: MS_PER_UNIT } } };
    }
  });

/**
 * The local calendar day of `ms`, as UTC midnight -- the same form a
 * frontmatter date takes, so a note saved late in the evening lands on the day
 * its author saw, not the next one in UTC.
 *
 * @param {number} ms
 */
function localDay(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
