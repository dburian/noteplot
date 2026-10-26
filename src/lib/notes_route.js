import { error } from '@sveltejs/kit';

/**
 * One note as the preprocessor's notes emitter writes it to
 * `src/lib/generated/notes/<slug>.json`. The shape is defined by the
 * preprocessor, so this typedef is a description of generated data, not a
 * contract the frontend can enforce -- keep it in step with
 * `preprocessor/emitters/notes.js` by hand.
 *
 * `links` and `backlinks` embed the neighbour's `title` as well as its slug,
 * which is why one edit can invalidate files that did not change; see the root
 * `CLAUDE.md`.
 *
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   html: string,
 *   links: Array<{slug: string, title: string}>,
 *   backlinks: Array<{slug: string, title: string}>,
 *   matter: Record<string, any>,
 *   path: string,
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
  import.meta.glob('$lib/generated/notes/*.json')
);

/** @type {Map<string, () => Promise<{default: Note}>>} */
const notesBySlug = new Map();
for (const [filePath, loadModule] of Object.entries(noteModules)) {
  // The notes have `generated/notes/` to themselves, so every file in it is a
  // note -- there is no reserved prefix to filter out any more.
  const slug = filePath.slice(filePath.lastIndexOf('/') + 1, -'.json'.length);
  notesBySlug.set(slug, loadModule);
}

/**
 * Every note that has been asked for: the resolved JSON once it has arrived,
 * the in-flight promise before that.
 *
 * @type {Map<string, Note | Promise<Note>>}
 */
const noteCache = new Map();

/**
 * The note if it is already loaded, else the promise for it.
 *
 * **The return value is stable per slug, and that is the whole point.** Svelte
 * compiles `{#await expr}` with an identity guard -- `r !== (r = expr) &&
 * handle_promise(...)` -- so an expression that mints a fresh promise on every
 * call makes the await block destroy its resolved branch and remount the
 * pending one. `Tile` re-evaluates that expression on every `$tiles` write,
 * because `tile` is an object prop and Svelte's `safe_not_equal` calls every
 * object assignment a change, so `{#await loadNote(slug)}` blanked every open
 * column back to "Loading ..." on every split, close and focus change -- and
 * with the content collapsed to one line the browser clamped that column's
 * `scrollTop` to zero.
 *
 * Two consequences of returning a plain value once it is known, both wanted:
 * the then-branch renders **synchronously**, which is what puts the real note
 * in the prerendered HTML and what keeps a newly split column from flashing;
 * and the one identity change from promise to value is safe, because
 * `handle_promise` handed a non-promise while it is already showing the
 * then-branch only assigns `info.resolved`.
 *
 * @param {string} slug a slug from `toSlug`, opaque -- never split it on `-`
 * @returns {Note | Promise<Note>}
 */
export function getNote(slug) {
  const cached = noteCache.get(slug);
  if (cached) return cached;

  const loadModule = notesBySlug.get(slug);
  // A rejected promise, never a synchronous throw: this is called from a
  // template expression, where a throw takes the whole render down. The tile
  // renders its own `{:catch}`; the 404 belongs to the route path below.
  if (!loadModule) return Promise.reject(new Error(`Note ${slug} not found.`));

  const pending = loadModule().then(
    (module) => {
      noteCache.set(slug, module.default);
      return module.default;
    },
    (err) => {
      // Evict, so the next render retries rather than being stuck in `{:catch}`
      // forever after one failed chunk fetch.
      noteCache.delete(slug);
      throw err;
    }
  );

  noteCache.set(slug, pending);
  return pending;
}

/**
 * Loads one note's generated JSON, or 404s. The route path -- `error()` is a
 * SvelteKit response, which only a `load` can produce.
 *
 * It goes through `getNote`, so **a route's own `load` warms the cache**, and
 * that is what the prerender depends on: the server renders one tile whose slug
 * is the path's, and by the time `ContentPane` runs, the note is a value rather
 * than a promise.
 *
 * @param {string} slug a slug from `toSlug`, opaque -- never split it on `-`
 * @returns {Promise<Note>}
 */
export async function loadNote(slug) {
  if (!notesBySlug.has(slug)) error(404, { message: `Note ${slug} not found.` });

  return getNote(slug);
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
 * `search.json` gets inlined into the bundle (ISSUES.md B2). It used to live
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
    searchNotesPromise = import('$lib/generated/search.json').then((m) => m.default);
  }

  return searchNotesPromise;
}
