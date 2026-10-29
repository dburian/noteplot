import { createSearchEngine } from './search_core.js';

/**
 * The search worker: owns the index and the note bodies. The protocol, all
 * messages plain objects:
 *
 * in   `{type: 'init', notes}`                          once, `NOTES_INDEX.all`
 *      `{type: 'search', id, parsed, snippets, window}` `snippets` = how many
 *                                                       of the best hits get one
 *      `{type: 'snippets', id, requests, window}`       more rows' snippets
 * out  `{type: 'ready'}`
 *      `{type: 'result', id, hits?, snippets}`
 *      `{type: 'error', id?, message}`                  no `id`: init failed
 *
 * Requests that arrive while the index is building wait for it, in order.
 * `search.json` is imported **here**, not on the main thread, so the bodies
 * are downloaded and parsed once, by the only code that needs them.
 */

/** @type {Promise<ReturnType<typeof createSearchEngine>> | null} */
let engine = null;

/** @param {any} message */
function post(message) {
  /** @type {Worker} */ (/** @type {unknown} */ (self)).postMessage(message);
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    engine = import('$lib/generated/search.json').then((m) =>
      createSearchEngine(data.notes, m.default)
    );
    engine.then(
      () => post({ type: 'ready' }),
      (err) => post({ type: 'error', message: String(err?.message ?? err) })
    );
    return;
  }

  try {
    if (!engine) throw new Error('search worker used before init');
    const { search, snippets } = await engine;

    if (data.type === 'search') {
      const hits = search(data.parsed);
      const first = hits
        .slice(0, data.snippets)
        .map((h) => ({ slug: h.slug, terms: Object.keys(h.match) }));
      post({ type: 'result', id: data.id, hits, snippets: snippets(first, data.window) });
    } else if (data.type === 'snippets') {
      post({ type: 'result', id: data.id, snippets: snippets(data.requests, data.window) });
    }
  } catch (err) {
    post({ type: 'error', id: data.id, message: String(/** @type {any} */ (err)?.message ?? err) });
  }
};
