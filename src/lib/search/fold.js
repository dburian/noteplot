/**
 * The one normalisation every part of search agrees on: decompose, drop the
 * combining marks, lowercase. `čas` and `cas` fold to the same term, so a
 * query typed without diacritics finds a note written with them, and the
 * other way round.
 *
 * It is minisearch's `processTerm` (index **and** query time), the phrase
 * check's normaliser, and what `snippet.js` matches against. Those three must
 * stay one function: a term the index folded one way and the snippet another
 * would match but never highlight.
 *
 * @param {string} s
 * @returns {string}
 */
export function fold(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
