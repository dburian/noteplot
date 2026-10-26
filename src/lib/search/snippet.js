/**
 * Match-centred excerpts for the search and filter result rows.
 *
 * The rows used to show `content.slice(0, 160)` — the *opening* of the note,
 * which tells you a note matched but never where or why. This slides a window
 * to the first matched term instead, and marks every occurrence inside it so
 * the row can bold them.
 *
 * Pure: no Svelte, no DOM. `buildSnippet` runs in the search worker, which is
 * the only place note bodies live; `highlight` runs on the main thread for
 * titles and tags. The row renders `parts` with an `{#each}` and
 * **never** `{@html}` — this is note text, not markup.
 */

import { fold } from './fold.js';

/**
 * A run of the excerpt, either plain or one of the matched terms.
 *
 * @typedef {{text: string, match: boolean}} SnippetPart
 */

/**
 * @typedef {{parts: SnippetPart[], head: boolean, tail: boolean}} Snippet
 * `head` / `tail` say whether the window was cut at that end, i.e. whether the
 * row should print a leading / trailing ellipsis.
 */

/** Roughly two lines of `text-sm` in a default-width content pane. */
const DEFAULT_WINDOW = 220;

/** How much of the window sits *before* the match. */
const LEAD_RATIO = 1 / 3;

/**
 * The escape is not optional: minisearch tokenises on punctuation, but not on
 * symbols, so a term can still reach us containing `+`, `$` or `|`.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Only match at the *start* of a word, and deliberately not at the end.
 *
 * A term in `matchedFields` is a whole *document* token that really occurs in
 * the note — with prefix and fuzzy matching on, minisearch still reports the
 * indexed term it hit (`convexity` for `conv`), never the query. Highlighting
 * mid-word would then be a lie: `form` cannot have matched `transformers`, so
 * bolding the `form` inside it points at text that had nothing to do with
 * the hit. A *trailing* boundary would be wrong the
 * other way — it would refuse to bold the `convex` of `convexity`, which is
 * the shape every good search UI does highlight.
 *
 * `\b` is not usable here: it is ASCII-only in JavaScript, so in `časy` the
 * `č` counts as a non-word character and `\bčas` never matches. A personal
 * note collection is exactly where that bites, hence the Unicode property
 * escapes and the `u` flag.
 */
const WORD_START = '(?<![\\p{L}\\p{N}_])';

/**
 * Every occurrence of any term, merged so overlapping hits become one run and
 * the longest term wins at a shared start.
 *
 * @param {string} haystack folded
 * @param {string[]} terms folded, non-empty
 * @returns {Array<{start: number, end: number}>} sorted, non-overlapping
 */
function findRanges(haystack, terms) {
  /** @type {Array<{start: number, end: number}>} */
  const hits = [];

  for (const term of terms) {
    const re = new RegExp(WORD_START + escapeRegExp(term), 'gu');
    for (let m = re.exec(haystack); m; m = re.exec(haystack)) {
      hits.push({ start: m.index, end: m.index + m[0].length });
      // A zero-length match would spin forever; terms are non-empty, but the
      // guard costs nothing and the alternative is a hung tab.
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  /** @type {Array<{start: number, end: number}>} */
  const merged = [];
  for (const hit of hits) {
    const last = merged[merged.length - 1];
    if (last && hit.start <= last.end) last.end = Math.max(last.end, hit.end);
    else merged.push({ ...hit });
  }

  return merged;
}

/** Per-character `fold`, memoised: a note uses a few dozen distinct letters. @type {Map<string, string>} */
const foldedChars = new Map();

/**
 * `text` folded, plus where each folded code unit came from. Folding is per
 * character, so a precomposed `č` becomes `c` in one place and the map is
 * mostly the identity — but not always (`ß` stays, a decomposed `c` + caron is
 * two units in and one out), and a range found in the folded text has to be
 * cut out of the original one.
 *
 * @param {string} text
 * @returns {{folded: string, from: number[], to: number[]}} `from[i]` / `to[i]`
 *   are the original start and end of folded unit `i`
 */
function foldWithMap(text) {
  let folded = '';
  /** @type {number[]} */
  const from = [];
  /** @type {number[]} */
  const to = [];

  let at = 0;
  for (const ch of text) {
    // ASCII needs no decomposition, and it is nearly all of most notes.
    let f = ch < '\x80' ? ch.toLowerCase() : foldedChars.get(ch);
    if (f === undefined) foldedChars.set(ch, (f = fold(ch)));
    // A lone combining mark folds to nothing; it belongs to the letter before
    // it, so a highlight of that letter must not stop short of it.
    if (f.length === 0 && to.length) to[to.length - 1] = at + ch.length;
    for (let i = 0; i < f.length; i += 1) {
      from.push(at);
      to.push(at + ch.length);
    }
    folded += f;
    at += ch.length;
  }

  return { folded, from, to };
}

/**
 * Widen an index outwards to the nearest space, so the window does not slice a
 * word in half. Bounded by `limit` so a run of text with no spaces in it (a
 * URL, a long formula) cannot drag the window across the whole note.
 *
 * @param {string} text
 * @param {number} index
 * @param {-1|1} direction
 * @param {number} [limit]
 * @returns {number}
 */
function snapToSpace(text, index, direction, limit = 24) {
  for (let i = 0; i < limit; i += 1) {
    const at = index + direction * i;
    if (at <= 0) return 0;
    if (at >= text.length) return text.length;
    if (text[at] === ' ') return direction === -1 ? at + 1 : at;
  }
  return index;
}

/**
 * Where any of `terms` occurs in `text`, in `text`'s own offsets. Matching is
 * on the folded text (the terms are folded), slicing on the original.
 *
 * @param {string} text
 * @param {string[] | undefined} terms
 * @returns {Array<{start: number, end: number}>}
 */
function matchRanges(text, terms) {
  const usable = (terms ?? []).map(fold).filter(Boolean);
  if (!usable.length) return [];
  const { folded, from, to } = foldWithMap(text);
  return findRanges(folded, usable).map((r) => ({ start: from[r.start], end: to[r.end - 1] }));
}

/**
 * `text[start, end)` as alternating plain and matched runs.
 *
 * @param {string} text
 * @param {Array<{start: number, end: number}>} ranges sorted, non-overlapping
 * @param {number} start
 * @param {number} end
 * @returns {SnippetPart[]}
 */
function cut(text, ranges, start, end) {
  /** @type {SnippetPart[]} */
  const parts = [];
  let at = start;
  for (const range of ranges) {
    if (range.end <= start) continue;
    if (range.start >= end) break;

    const from = Math.max(range.start, start);
    const to = Math.min(range.end, end);
    if (from > at) parts.push({ text: text.slice(at, from), match: false });
    parts.push({ text: text.slice(from, to), match: true });
    at = to;
  }
  if (at < end) parts.push({ text: text.slice(at, end), match: false });
  return parts;
}

/**
 * A short string — a title, a tag — whole, with the matched terms marked.
 * Same matching rules as the snippet, no window. Cheap enough to run on the
 * main thread per row: these are a few dozen characters.
 *
 * @param {string} text
 * @param {string[]} terms folded document terms
 * @returns {SnippetPart[]}
 */
export function highlight(text, terms) {
  if (!text) return [];
  return cut(text, matchRanges(text, terms), 0, text.length);
}

/**
 * @param {string} content plaintext, as stored in `search.json`
 * @param {string[]} terms `Object.keys(match)` — minisearch's *matched
 *   document terms*. They are folded (`fold.js`), so they occur in the folded
 *   `content`; there is no stemming to undo.
 * @param {{window?: number}} [opts]
 * @returns {Snippet}
 */
export function buildSnippet(content, terms, opts = {}) {
  const size = opts.window ?? DEFAULT_WINDOW;

  // Once, and everything below indexes into this: the record's newlines are
  // paragraph breaks, and each would otherwise be a line of its own in a row
  // that is two lines tall.
  const text = (content ?? '').replace(/\s+/g, ' ').trim();

  if (text === '') return { parts: [], head: false, tail: false };

  const ranges = matchRanges(text, terms);

  // No terms, or none of them present: fall back to the opening of the note,
  // which is also what the filter overlay gets when nothing was parsed.
  const first = ranges[0]?.start ?? 0;

  let start = Math.max(0, first - Math.floor(size * LEAD_RATIO));
  let end = Math.min(text.length, start + size);
  // A match near the end would otherwise get a stub of a window.
  if (end === text.length) start = Math.max(0, end - size);

  if (start > 0) start = snapToSpace(text, start, -1);
  if (end < text.length) end = snapToSpace(text, end, 1);

  const parts = cut(text, ranges, start, end);

  return { parts, head: start > 0, tail: end < text.length };
}
