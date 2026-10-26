/**
 * Match-centred excerpts for the search and filter result rows.
 *
 * The rows used to show `content.slice(0, 160)` — the *opening* of the note,
 * which tells you a note matched but never where or why. This slides a window
 * to the first matched term instead, and marks every occurrence inside it so
 * the row can bold them.
 *
 * Pure: no Svelte, no DOM. The caller renders `parts` with an `{#each}` and
 * **never** `{@html}` — this is note text, not markup.
 */

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
 * The escape is not optional: minisearch tokenises on non-word characters, but
 * a term can still reach us containing one (a quoted phrase is matched as its
 * constituent terms, and `processTerm` only lowercases).
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
 * minisearch tokenises, and neither prefix nor fuzzy search is enabled, so a
 * term in `matchedFields` is a whole token that really occurs in the note.
 * Highlighting it mid-word would then be a lie: searching `form` cannot have
 * matched `transformers`, so bolding the `form` inside it points at text that
 * had nothing to do with the hit. A *trailing* boundary would be wrong the
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
 * @param {string} haystack lowercased
 * @param {string[]} terms lowercased, non-empty
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
 * @param {string} content plaintext, as stored in `search.json`
 * @param {string[]} terms `Object.keys(match.matchedFields)` — minisearch's
 *   *matched document terms*, so they occur verbatim (case-insensitively) in
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

  const usable = (terms ?? []).map((t) => t.toLowerCase()).filter(Boolean);
  const ranges = usable.length ? findRanges(text.toLowerCase(), usable) : [];

  // No terms, or none of them present: fall back to the opening of the note,
  // which is also what the filter overlay gets when nothing was parsed.
  const first = ranges[0]?.start ?? 0;

  let start = Math.max(0, first - Math.floor(size * LEAD_RATIO));
  let end = Math.min(text.length, start + size);
  // A match near the end would otherwise get a stub of a window.
  if (end === text.length) start = Math.max(0, end - size);

  if (start > 0) start = snapToSpace(text, start, -1);
  if (end < text.length) end = snapToSpace(text, end, 1);

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

  return { parts, head: start > 0, tail: end < text.length };
}
