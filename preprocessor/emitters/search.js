import { bySlug } from '../util.js';

/**
 * `search.json`: the plaintext of every note, for the search and filter
 * overlays. Straight from each record's `text` -- this used to read and parse
 * every file a second time to get it.
 *
 * Rewritten whole. Incremental updates would save nothing on the frontend,
 * which re-reads the whole file anyway.
 *
 * @type {import('../types.js').Emitter}
 */
export const searchEmitter = {
  id: 'search',
  deps: ['title', 'text', 'matter', 'path'],

  async emit(corpus, changes, { writer }) {
    await writer.write(
      'search.json',
      bySlug(corpus.records.values()).map(({ slug, path, title, text, matter }) => ({
        slug,
        // Display only -- the overlays show a result's directory, and slugs are
        // opaque (see the Slugs section of the root CLAUDE.md).
        path,
        title,
        content: text,
        matter: { ...matter }
      }))
    );
  }
};
