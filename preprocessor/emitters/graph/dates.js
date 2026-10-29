import { defineGraphEmitter } from './define_graph.js';
import { UNITS_PER_DAY } from './layouts.js';

const MS_PER_DAY = 86_400_000;
const MS_PER_UNIT = MS_PER_DAY / UNITS_PER_DAY;

/** How far from its day cell's centre a note may be moved to clear a same-cell note: under half a day. */
const SPREAD_RADIUS = UNITS_PER_DAY * 0.45;

/** The golden angle, so a cell's notes fill a disc evenly (phyllotaxis). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * The date graph: one node per note on a created × accessed grid, with the link
 * graph's edges. x is the day the note was created, y the day it was last
 * accessed, later days higher up. Nothing is laid out: `build` pins both
 * coordinates.
 *
 * The dates come from `preprocessor/dates.js`: first and last commit, or, for a
 * note git does not track, its file's birthtime (or mtime) and mtime. Those
 * carry `dateSource: 'fs'` so the renderer can draw them as the guess they are.
 *
 * Both coordinates are absolute: `ms / msPerUnit`, with the epoch at 0, and y
 * negated because screen y grows downward. The output's `timeAxes` is that
 * mapping, for the renderer's date ticks -- `msPerUnit` is negative for y, so
 * the same `originMs + coord * msPerUnit` maps it back -- and each axis's
 * `label`, which the renderer prints in its band. Nothing about it
 * depends on the collection, so adding an older note moves nothing else.
 *
 * Notes that share a day cell -- created and last edited on the same days --
 * would land on one point. They are spread over a small disc around it,
 * ordered by slug so the result is stable, and never further than half a day.
 */
export const createDateGraphEmitter = () =>
  defineGraphEmitter({
    id: 'dates',
    // `accessed` moves on every save, which moves that note's node; with no
    // layout to run, rewriting the file is cheap.
    deps: ['title', 'matter', 'linkSlugs', 'created', 'accessed', 'dateSource'],
    layout: 'date',
    build(corpus) {
      /** @type {Map<string, Record<string, any>[]>} */
      const cells = new Map();
      const links = [];
      for (const {
        slug,
        title,
        matter,
        linkSlugs,
        created,
        accessed,
        dateSource
      } of corpus.records.values()) {
        const fx = localDay(created) / MS_PER_UNIT;
        const fy = -localDay(accessed) / MS_PER_UNIT;
        const key = `${fx},${fy}`;
        const node = { slug, title, matter, dateSource, fx, fy };
        const cell = cells.get(key);
        if (cell) cell.push(node);
        else cells.set(key, [node]);
        for (const target of linkSlugs) links.push({ source: slug, target });
      }

      const nodes = [...cells.values()].flatMap(spreadCell);
      const axis = (/** @type {string} */ label, /** @type {number} */ msPerUnit) => ({
        label,
        originMs: 0,
        msPerUnit
      });
      return {
        nodes,
        links,
        extra: { timeAxes: { x: axis('created', MS_PER_UNIT), y: axis('accessed', -MS_PER_UNIT) } }
      };
    }
  });

/**
 * Spreads the notes of one day cell over a disc of `SPREAD_RADIUS` around its
 * centre, on a phyllotaxis spiral. A lone note stays on the centre.
 *
 * @param {Record<string, any>[]} cell
 */
function spreadCell(cell) {
  if (cell.length == 1) return cell;
  cell.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return cell.map((node, i) => {
    const r = SPREAD_RADIUS * Math.sqrt((i + 0.5) / cell.length);
    const angle = i * GOLDEN_ANGLE;
    return { ...node, fx: node.fx + r * Math.cos(angle), fy: node.fy + r * Math.sin(angle) };
  });
}

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
