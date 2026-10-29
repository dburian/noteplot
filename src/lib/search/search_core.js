import MiniSearch from 'minisearch';

import { fold } from './fold.js';
import { FIELDS } from './query.js';
import { buildSnippet } from './snippet.js';

/**
 * The full-text index, and everything that needs a note's body: the search
 * itself, the phrase check and the snippets. It runs inside
 * `search.worker.js`, so building the index never blocks the page and the
 * main thread never holds the plaintext of the collection. Pure apart from
 * that — no DOM, no worker API — so it can be driven from `node`.
 *
 * Measured at 10k notes of ~500 words: ~6.5 s to build (in the worker), a
 * query in 1–10 ms, a phrase check ~13 ms in the worst case, a snippet
 * ~50 µs. That is about the ceiling of this design; beyond ~20k notes the
 * download and the build call for a sharded, per-term index instead.
 */

/** Title hits outrank tag hits outrank body hits. */
const BOOST = { title: 3, tag: 2, content: 1 };

/** minisearch's edit-distance budget, as a fraction of the term's length. */
const FUZZY = 0.2;

/**
 * @typedef {import('$lib/state/notes_index.js').NoteSummary} NoteSummary
 * @typedef {{slug: string, content: string}} NoteBody one `search.json` record
 * @typedef {{slug: string, score: number, match: Record<string, string[]>}} Hit
 *   `match` is minisearch's `{documentTerm: [field, ...]}`
 * @typedef {{slug: string, terms: string[]}} SnippetRequest
 * @typedef {import('./query.js').ParsedQuery} ParsedQuery
 * @typedef {import('./query.js').QueryBlock} QueryBlock
 */

/**
 * @param {unknown} matter
 * @returns {string}
 */
function tagsOf(matter) {
  const tags = /** @type {{tags?: unknown} | undefined} */ (matter)?.tags;
  if (Array.isArray(tags)) return tags.join(' ');
  return typeof tags === 'string' ? tags : '';
}

/**
 * Text reduced to its words, folded, space-separated and space-padded, so a
 * phrase is found by `includes` regardless of case, diacritics, punctuation
 * or line breaks between its words — and only at word boundaries.
 *
 * @param {string} s
 */
function words(s) {
  return ` ${fold(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

/**
 * @param {QueryBlock} block
 * @returns {import('minisearch').Query}
 */
function blockQuery(block) {
  return {
    queries: [block.text],
    fields: block.fields,
    // Explicit at every level: a combination's options are inherited by its
    // children, so leaving this out under the AND_NOT root would make a
    // negated phrase exclude notes with *any* of its words.
    combineWith: 'AND',
    prefix: block.prefix,
    fuzzy: block.fuzzy ? FUZZY : false
  };
}

/**
 * Negated phrases are left out: AND_NOT of their words would exclude every
 * note containing all of them anywhere. They are a post-filter instead.
 *
 * @param {ParsedQuery} parsed
 * @returns {import('minisearch').Query}
 */
export function toMiniSearch(parsed) {
  const positives = parsed.blocks.filter((b) => !b.negate).map(blockQuery);
  const negatives = parsed.blocks.filter((b) => b.negate && !b.phrase).map(blockQuery);

  /** @type {import('minisearch').Query} */
  const positive = positives.length
    ? { combineWith: 'AND', queries: positives }
    : // Only negations or path filters: start from every note.
      MiniSearch.wildcard;

  return negatives.length
    ? { combineWith: 'AND_NOT', queries: [positive, ...negatives] }
    : positive;
}

/**
 * @param {NoteSummary[]} summaries `NOTES_INDEX.all` — title, path and matter
 * @param {NoteBody[]} bodies `search.json`
 */
export function createSearchEngine(summaries, bodies) {
  const contentBySlug = new Map(bodies.map((b) => [b.slug, b.content]));

  const docs = summaries.map((n, id) => ({
    id,
    slug: n.slug,
    title: n.title ?? '',
    tag: tagsOf(n.matter),
    content: contentBySlug.get(n.slug) ?? '',
    path: fold(n.path ?? '')
  }));
  const bySlug = new Map(docs.map((d) => [d.slug, d]));

  const index = new MiniSearch({
    fields: FIELDS,
    // Index and query time both, so `cas` and `čas` are one term. The
    // snippets fold with the same function to find what to highlight.
    processTerm: fold,
    searchOptions: { boost: BOOST }
  });
  index.addAll(docs);

  /**
   * `words()` of a doc's field, cached. Normalising a 3 KB body is the
   * expensive part of a phrase check — uncached, a phrase of two common words
   * took 1.4 s at 10k notes, re-normalising every candidate per keystroke.
   * Filled lazily, so the memory (about one more copy of the bodies) is spent
   * only once phrases are actually used.
   *
   * @type {Map<string, string>[]}
   */
  const wordsCache = FIELDS.map(() => new Map());

  /**
   * @param {typeof docs[number]} doc
   * @param {string} field
   */
  function fieldWords(doc, field) {
    const cache = wordsCache[FIELDS.indexOf(field)];
    let w = cache.get(doc.slug);
    if (w === undefined) {
      w = words(/** @type {Record<string, any>} */ (doc)[field] ?? '');
      cache.set(doc.slug, w);
    }
    return w;
  }

  /**
   * @param {ParsedQuery} parsed
   * @returns {Hit[]} best first
   */
  function search(parsed) {
    const phrases = parsed.blocks
      .filter((b) => b.phrase)
      .map((b) => ({ needle: words(b.text), fields: b.fields, negate: b.negate }));

    /** @param {typeof docs[number]} doc */
    const keep = (doc) =>
      parsed.paths.every(
        ({ value, negate }) =>
          (doc.path.startsWith(value) || doc.path.includes(`/${value}`)) !== negate
      ) &&
      phrases.every(
        ({ needle, fields, negate }) =>
          fields.some((f) => fieldWords(doc, f).includes(needle)) !== negate
      );

    /** @type {Hit[]} */
    const hits = [];
    for (const result of index.search(toMiniSearch(parsed))) {
      const doc = docs[result.id];
      if (keep(doc)) hits.push({ slug: doc.slug, score: result.score, match: result.match });
    }
    return hits;
  }

  /**
   * @param {SnippetRequest[]} requests
   * @param {number} [window]
   * @returns {Record<string, import('./snippet.js').Snippet>}
   */
  function snippets(requests, window) {
    /** @type {Record<string, import('./snippet.js').Snippet>} */
    const out = {};
    for (const { slug, terms } of requests) {
      const doc = bySlug.get(slug);
      if (doc) out[slug] = buildSnippet(doc.content, terms, { window });
    }
    return out;
  }

  return { search, snippets };
}
