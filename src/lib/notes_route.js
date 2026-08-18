import { error } from '@sveltejs/kit';

/**
  * The two note routes -- `(graph)/[slug]` and `(graph)/notes/[slug]` -- share
  * everything except which flags their `load` returns, so both `load` bodies and
  * both `entries()` used to be duplicated verbatim (ISSUES.md B10).
  *
  * The glob is also what keeps the routes off the filesystem. `entries()` used to
  * `readdir('src/lib/notes')`, which coupled it both to the preprocessor's output
  * path and to the process CWD (ISSUES.md A12). Vite resolves this at build time
  * instead, and the loaders stay lazy -- one chunk per note, which is exactly
  * what a dynamic `import()` on a template literal already compiled to.
  */
const noteModules = /** @type {Record<string, () => Promise<{default: any}>>} */ (
  import.meta.glob('$lib/notes/*.json')
);

/** @type {Map<string, () => Promise<{default: any}>>} */
const notesBySlug = new Map()
for (const [filePath, loadModule] of Object.entries(noteModules)) {
  const slug = filePath.slice(filePath.lastIndexOf('/') + 1, -'.json'.length)

  // `__graph.json` and `__search.json` live in the same directory and are not
  // notes. This is the one place that convention is enforced -- see
  // `src/routes/CLAUDE.md`.
  if (slug.startsWith('__')) continue

  notesBySlug.set(slug, loadModule)
}

/**
  * Loads one note's generated JSON, or 404s.
  *
  * @param {string} slug a slug from `toSlug`, opaque -- never split it on `-`
  */
export async function loadNote(slug) {
  const loadModule = notesBySlug.get(slug)
  if (!loadModule) error(404, { message: `Note ${slug} not found.` })

  return (await loadModule()).default
}

/**
  * Every note page to prerender.
  */
export function noteEntries() {
  return [...notesBySlug.keys()].map(slug => ({ slug }))
}
