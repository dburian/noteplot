/**
 * @typedef {{slug: string, title: string, path?: string, matter?: Record<string, any>}} NoteSummary
 * @typedef {{bySlug: Map<string, NoteSummary>, all: NoteSummary[], titleOf: (slug: string) => string}} NotesIndex
 */

/**
 * A slug → `{slug, title, path, matter}` lookup built from the preprocessor's
 * `index.json`. It lets the toolbar chips, tile headers and command palette
 * show a note's title without fetching that note's JSON.
 *
 * It used to be built from the graph's nodes, which made "which notes exist"
 * depend on one visualization. A graph may now hold nodes that are not notes --
 * the tag graph's tags -- so `bySlug.has(slug)` is also how `VizPane` decides
 * whether a clicked node is something it can open.
 *
 * Not a store: the index is static for the lifetime of a build.
 *
 * @param {NoteSummary[]} notes
 * @returns {NotesIndex}
 */
export function createNotesIndex(notes) {
  /** @type {NoteSummary[]} */
  const all = (notes ?? []).map((n) => ({
    slug: n.slug,
    title: n.title,
    path: n.path,
    matter: n.matter
  }));
  const bySlug = new Map(all.map((n) => [n.slug, n]));

  /**
   * Falls back to the slug itself. Slugs are opaque and not meant to be shown
   * to people, but an unresolvable slug in a chip is better than an empty one.
   *
   * @param {string} slug
   */
  function titleOf(slug) {
    return bySlug.get(slug)?.title ?? slug;
  }

  return { bySlug, all, titleOf };
}
