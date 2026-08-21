import { error } from '@sveltejs/kit';

/**
 * One note as `NotePipeline` writes it to `src/lib/notes/<slug>.json`. The
 * shape is defined by the preprocessor, so this typedef is a description of
 * generated data, not a contract the frontend can enforce -- keep it in step
 * with `note_pipeline.js` by hand.
 *
 * `links` and `backlinks` embed the neighbour's `title` as well as its slug,
 * which is why one edit can invalidate files that did not change; see the root
 * `CLAUDE.md`.
 *
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   content: string,
 *   links: Array<{slug: string, title: string}>,
 *   backlinks: Array<{slug: string, title: string}>,
 *   images: string[],
 *   matter: Record<string, any>,
 *   noteRoot: string,
 *   originalPath: string,
 *   readingTime: {text: string, minutes: number, time: number, words: number},
 * }} Note
 */

/**
 * The two note routes -- `(app)/[slug]` and `(app)/notes/[slug]` -- share
 * everything except which flags their `load` returns, so both `load` bodies and
 * both `entries()` used to be duplicated verbatim (ISSUES.md B10).
 *
 * The glob is also what keeps the routes off the filesystem. `entries()` used to
 * `readdir('src/lib/notes')`, which coupled it both to the preprocessor's output
 * path and to the process CWD (ISSUES.md A12). Vite resolves this at build time
 * instead, and the loaders stay lazy -- one chunk per note, which is exactly
 * what a dynamic `import()` on a template literal already compiled to.
 */
const noteModules = /** @type {Record<string, () => Promise<{default: Note}>>} */ (
  import.meta.glob('$lib/notes/*.json')
);

/** @type {Map<string, () => Promise<{default: Note}>>} */
const notesBySlug = new Map();
for (const [filePath, loadModule] of Object.entries(noteModules)) {
  const slug = filePath.slice(filePath.lastIndexOf('/') + 1, -'.json'.length);

  // `__graph.json` and `__search.json` live in the same directory and are not
  // notes. This is the one place that convention is enforced -- see
  // `src/routes/CLAUDE.md`.
  if (slug.startsWith('__')) continue;

  notesBySlug.set(slug, loadModule);
}

/**
 * Loads one note's generated JSON, or 404s.
 *
 * @param {string} slug a slug from `toSlug`, opaque -- never split it on `-`
 * @returns {Promise<Note>}
 */
export async function loadNote(slug) {
  const loadModule = notesBySlug.get(slug);
  if (!loadModule) error(404, { message: `Note ${slug} not found.` });

  return (await loadModule()).default;
}

/**
 * Every note page to prerender.
 */
export function noteEntries() {
  return [...notesBySlug.keys()].map((slug) => ({ slug }));
}

/**
 * The plaintext of every note, for the search and filter overlays.
 *
 * Dynamic, for the same reason as the glob above: a static import of
 * `__search.json` gets inlined into the bundle (ISSUES.md B2). It used to live
 * in the `/search` and `/filter` routes' `load`s, which are gone -- the
 * overlays are reachable from anywhere now, so the fetch has to be lazy rather
 * than route-scoped.
 *
 * Returning the *same* promise every time is load-bearing: `getSearchIndex`
 * memoises one index on the notes array's identity, so a second array would
 * re-index the whole corpus (ISSUES.md B3).
 *
 * @type {Promise<any[]> | null}
 */
let searchNotesPromise = null;

export function loadSearchNotes() {
  if (!searchNotesPromise) {
    searchNotesPromise = import('$lib/notes/__search.json').then((m) => m.default);
  }

  return searchNotesPromise;
}
