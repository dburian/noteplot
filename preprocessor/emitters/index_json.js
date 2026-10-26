import { bySlug } from '../util.js';

/**
 * `index.json`: `[{slug, title, path, matter}]` for every note -- the
 * frontend's `NOTES_INDEX`, which the toolbar, the tile headers and the command
 * palette read titles from. It used to be derived from the graph's nodes, which
 * tied the app's idea of "which notes exist" to one particular visualization.
 *
 * @type {import('../types.js').Emitter}
 */
export const indexEmitter = {
  id: 'index',
  deps: ['title', 'path', 'matter'],

  async emit(corpus, changes, { writer }) {
    await writer.write(
      'index.json',
      bySlug(corpus.records.values()).map(({ slug, title, path, matter }) => ({
        slug,
        title,
        path,
        matter
      }))
    );
  }
};
