/**
 * The main thread's handle on `search.worker.js`.
 *
 * The worker is started when a search or filter overlay **opens** (or a
 * `?filter=` link is applied), not at load: it fetches the plaintext of every
 * note, which a visitor who never searches should not pay for — and the overlays are mounted by `(app)/+layout.svelte`, whose chunk
 * loads on every page. Only a URL to the worker lands in that chunk;
 * `minisearch` and `search.json` live in the worker's own.
 *
 * One worker for the app, so the search and filter overlays share one index.
 *
 * The worker answers with slugs; this joins them back to `NOTES_INDEX`, which
 * the page already holds, so a `Match` carries title, path and matter without
 * the worker sending them.
 */

/** Rows rendered per page of results, and snippets fetched per request. */
export const PAGE = 50;

/**
 * `matchedFields` is minisearch's `match`: `{documentTerm: [field, ...]}`,
 * terms folded (`fold.js`).
 *
 * @typedef {{
 *   note: import('$lib/state/notes_index.js').NoteSummary,
 *   score: number,
 *   matchedFields: Record<string, string[]>,
 * }} Match
 * @typedef {Record<string, import('./snippet.js').Snippet>} Snippets by slug
 * @typedef {ReturnType<typeof createClient>} SearchClient
 */

/** @type {SearchClient | null} */
let client = null;

/**
 * @param {import('$lib/state/notes_index.js').NotesIndex} notesIndex
 * @returns {SearchClient}
 */
export function getSearchClient(notesIndex) {
  if (!client) client = createClient(notesIndex);
  return client;
}

/**
 * @param {import('$lib/state/notes_index.js').NotesIndex} notesIndex
 */
function createClient(notesIndex) {
  const worker = new Worker(new URL('./search.worker.js', import.meta.url), { type: 'module' });

  /** @type {Map<number, {resolve: (data: any) => void, reject: (err: Error) => void}>} */
  const pending = new Map();
  let nextId = 0;
  let ready = false;
  /** Set once the worker cannot serve anything; every later request fails with it. @type {Error | null} */
  let broken = null;

  /** @param {Error} err */
  function fail(err) {
    broken = err;
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  }

  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') {
      ready = true;
      return;
    }
    if (data.type === 'error' && data.id === undefined) {
      fail(new Error(`search index failed to build: ${data.message}`));
      return;
    }
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.type === 'error') request.reject(new Error(data.message));
    else request.resolve(data);
  };
  worker.onerror = (ev) => fail(new Error(`search worker crashed: ${ev.message}`));

  worker.postMessage({ type: 'init', notes: notesIndex.all });

  /**
   * @param {Record<string, any>} message
   * @returns {Promise<any>}
   */
  function request(message) {
    if (broken) return Promise.reject(broken);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  }

  /**
   * Every hit, best first — the filter needs all of them for the graph — and
   * snippets for the first `PAGE`. Waits for the index if it is still
   * building. Replies are not ordered against other calls; callers keep their
   * own "is this still the newest run" check.
   *
   * @param {import('./query.js').ParsedQuery} parsed
   * @returns {Promise<{matches: Match[], snippets: Snippets}>}
   */
  async function search(parsed) {
    const data = await request({ type: 'search', parsed, snippets: PAGE });

    /** @type {Match[]} */
    const matches = [];
    for (const hit of data.hits) {
      // A slug missing from index.json would be a preprocessor bug; drop it
      // rather than render a row that cannot open.
      const note = notesIndex.bySlug.get(hit.slug);
      if (note) matches.push({ note, score: hit.score, matchedFields: hit.match });
    }
    return { matches, snippets: data.snippets };
  }

  /**
   * @param {Match[]} matches
   * @returns {Promise<Snippets>}
   */
  async function snippets(matches) {
    const requests = matches.map((m) => ({
      slug: m.note.slug,
      terms: Object.keys(m.matchedFields)
    }));
    return (await request({ type: 'snippets', requests })).snippets;
  }

  return {
    search,
    snippets,
    /** Whether the index is built — the overlays say "indexing" until it is. */
    get ready() {
      return ready;
    }
  };
}
