import { fold } from './fold.js';

/**
 * The search box's query language, parsed into plain data.
 *
 * Plain on purpose: the result crosses into the search worker with
 * `postMessage`, sits in the `FILTER` store, and is what `QueryDisplay`
 * renders. A minisearch `Query` could do none of that cleanly — it may hold
 * `MiniSearch.wildcard`, a `Symbol`, which structured clone refuses. The
 * worker turns this into a minisearch query (`search_core.js` `toMiniSearch`).
 * This module imports no minisearch, so the overlays can parse on the main
 * thread without pulling it into a chunk.
 *
 * The language, one token at a time, all tokens combined with AND:
 *
 * - `word` — in any field. The **last** token, when it has at least
 *   `PREFIX_MIN` characters and the input does not end in a space, also
 *   matches as a prefix, so results follow your typing. Terms of `FUZZY_MIN`
 *   characters or more tolerate a typo.
 * - `"a phrase"` — all its words, and then only notes containing them in that
 *   order. Exact: no prefix, no typo tolerance. An unterminated quote runs to
 *   the end of the input.
 * - `title:word`, `tag:word`, `content:word` — restrict a token to one field.
 *   Combines with quotes: `title:"two words"`.
 * - `path:dir` — not a term at all but a filter on the note's location
 *   (relative to the note root): a path prefix, or any directory component.
 * - a leading `-` negates any of the above.
 *
 * An unknown `field:` (`foo:bar`) is searched as ordinary text, as before.
 */

/**
 * The indexed fields, and the ones `field:term` may name. One list, read by
 * both the parser and `search_core.js`'s index, so the parser cannot offer a
 * field that was never indexed.
 */
export const FIELDS = ['content', 'title', 'tag'];

/**
 * Below three characters a prefix expands to a large part of the vocabulary:
 * measured at 10k notes, a 1-character prefix query took ~200 ms and a
 * 2-character one ~9 ms, against ~1 ms at three.
 */
export const PREFIX_MIN = 3;

/** Shorter terms are left exact: a typo budget on `cat` matches half the language. */
export const FUZZY_MIN = 4;

/**
 * @typedef {{
 *   text: string,
 *   fields: string[],
 *   negate: boolean,
 *   exact: boolean,
 *   phrase: boolean,
 *   prefix: boolean,
 *   fuzzy: boolean,
 * }} QueryBlock
 * One searched token. `exact` is set for anything quoted; `phrase` only for a
 * quoted block of more than one word, the only case where word order is
 * checked.
 *
 * @typedef {{value: string, negate: boolean}} PathFilter
 * `value` is folded, with leading and trailing `/` trimmed.
 *
 * @typedef {{blocks: QueryBlock[], paths: PathFilter[]}} ParsedQuery
 */

const TOKEN = /(-?)(?:([\p{L}\p{N}_]+):)?(?:"([^"]*)"?|(\S+))/gu;

/**
 * @param {string} searchString
 * @returns {ParsedQuery | null} `null` when there is nothing to search for
 */
export function parseSearchString(searchString) {
  /** @type {QueryBlock[]} */
  const blocks = [];
  /** @type {PathFilter[]} */
  const paths = [];

  for (const m of searchString.matchAll(TOKEN)) {
    const [raw, minus, field, quoted, bare] = m;
    const negate = minus === '-';
    const isQuoted = quoted !== undefined;
    const text = (isQuoted ? quoted : bare).trim();

    if (field === 'path') {
      const value = fold(text).replace(/^\/+|\/+$/g, '');
      if (value) paths.push({ value, negate });
      continue;
    }

    if (field !== undefined && !FIELDS.includes(field)) {
      // Not an operator: search the whole token, colon and all, as text.
      const whole = negate ? raw.slice(1) : raw;
      blocks.push(block(whole.replaceAll('"', ''), FIELDS, negate, false));
      continue;
    }

    // `tag:` with nothing after it yet: an operator being typed, not a term.
    if (!text || (!isQuoted && /^-?[\p{L}\p{N}_]+:$/u.test(raw) && isOperator(raw))) continue;
    blocks.push(block(text, field ? [field] : FIELDS, negate, isQuoted));
  }

  if (blocks.length === 0 && paths.length === 0) return null;

  // Prefix only on what is still being typed: the last block, unquoted,
  // positive, long enough, and not already followed by a space.
  const last = blocks[blocks.length - 1];
  if (
    last &&
    !last.negate &&
    !last.exact &&
    !/\s$/.test(searchString) &&
    last.text.length >= PREFIX_MIN
  ) {
    last.prefix = true;
  }

  return { blocks, paths };
}

/** @param {string} raw a bare `name:` token */
function isOperator(raw) {
  const name = raw.replace(/^-/, '').slice(0, -1);
  return name === 'path' || FIELDS.includes(name);
}

/**
 * @param {string} text
 * @param {string[]} fields
 * @param {boolean} negate
 * @param {boolean} quoted
 * @returns {QueryBlock}
 */
function block(text, fields, negate, quoted) {
  return {
    text,
    fields: [...fields],
    negate,
    exact: quoted,
    phrase: quoted && /\s/.test(text),
    prefix: false,
    // Excluding typo-neighbours of a word would remove notes you did not name.
    fuzzy: !quoted && !negate && text.length >= FUZZY_MIN
  };
}
