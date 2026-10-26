import { bySlug } from '../util.js';

/**
 * `search.json`: the plaintext of every note, `[{slug, content}]`, for the
 * search worker. Straight from each record's `text`.
 *
 * Bodies only. Title, path and matter are in `index.json`, which the page has
 * already loaded; the frontend joins the two on slug and hands them to the
 * worker, so they are neither downloaded twice nor rewritten here when only a
 * title changes.
 *
 * Rewritten whole. Incremental updates would save nothing on the frontend,
 * which re-reads the whole file anyway.
 *
 * @type {import('../types.js').Emitter}
 */
export const searchEmitter = {
  id: 'search',
  deps: ['text'],

  async emit(corpus, changes, { writer }) {
    await writer.write(
      'search.json',
      bySlug(corpus.records.values()).map(({ slug, text }) => ({ slug, content: text }))
    );
  }
};
