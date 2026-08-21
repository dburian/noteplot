/**
 * @typedef {{slug: string, title: string, matter?: Record<string, any>}} NoteSummary
 * @typedef {{bySlug: Map<string, NoteSummary>, all: NoteSummary[], titleOf: (slug: string) => string}} NotesIndex
 */

/**
 * A slug → `{slug, title, matter}` lookup built from `__graph.json`'s nodes,
 * which already carry all three. It lets the toolbar chips, tile headers and
 * command palette show a note's title without fetching that note's JSON.
 *
 * Not a store: graph data is static for the lifetime of a build.
 *
 * @param {{slug: string, title: string, matter?: Record<string, any>}[]} nodes
 * @returns {NotesIndex}
 */
export function createNotesIndex(nodes) {
  /** @type {NoteSummary[]} */
  const all = (nodes ?? []).map((n) => ({ slug: n.slug, title: n.title, matter: n.matter }));
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
