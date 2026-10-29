import { defineGraphEmitter } from './define_graph.js';
import { UNITS_PER_DAY } from './layouts.js';

const MS_PER_DAY = 86_400_000;
const MS_PER_UNIT = MS_PER_DAY / UNITS_PER_DAY;

/**
 * The date graph: one node per note, pinned left to right by creation date,
 * with the link graph's edges. Only y is laid out (the `date` layout).
 *
 * The date is the note's `created` (`preprocessor/dates.js`): its first commit,
 * or, for a note git does not track, its file's birthtime or mtime. Those carry
 * `dateSource: 'fs'` so the renderer can draw them as the guess they are.
 *
 * x is absolute: `ms / msPerUnit`, with the epoch at 0. The output's
 * `timeAxis` is that mapping, for the renderer's date ticks. Nothing about it
 * depends on the collection, so adding an older note moves nothing else.
 */
export const createDateGraphEmitter = () =>
  defineGraphEmitter({
    id: 'dates',
    // Not `accessed`: it moves on every save, and x does not depend on it.
    deps: ['title', 'matter', 'linkSlugs', 'created', 'dateSource'],
    layout: 'date',
    build(corpus) {
      const nodes = [];
      const links = [];
      for (const {
        slug,
        title,
        matter,
        linkSlugs,
        created,
        dateSource
      } of corpus.records.values()) {
        nodes.push({ slug, title, matter, dateSource, fx: localDay(created) / MS_PER_UNIT });
        for (const target of linkSlugs) links.push({ source: slug, target });
      }
      return { nodes, links, extra: { timeAxis: { originMs: 0, msPerUnit: MS_PER_UNIT } } };
    }
  });

/**
 * The local calendar day of `ms`, as UTC midnight, so a note committed late in
 * the evening lands on the day its author saw, not the next one in UTC.
 *
 * @param {number} ms
 */
function localDay(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
