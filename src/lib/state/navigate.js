/**
 * Open a note — the one entry point every navigation source funnels through:
 * a canvas click, a history chip, a prose link, a search result, a command.
 *
 * It is only the *tile* half. The navigation half is not here and must not be
 * added back: `WithAppState` watches the focused tile and rewrites the path
 * whenever the two disagree, so a `goto` at this call site would be a second
 * one for the same change and would push a duplicate history entry.
 *
 * That split is what makes closing a column, splitting one, and clicking into
 * another all update the URL for free — none of them go through here, and all
 * of them move focus. It also makes re-opening the note already in the focused
 * tile a genuine no-op: the store does not change, so nothing navigates.
 *
 * @param {import('./tiles.js').TilesStore} tiles
 * @param {string} slug
 * @param {{where?: 'focused'|'new'}} [opts]
 */
export function openNote(tiles, slug, opts = {}) {
  tiles.open(slug, { where: opts.where ?? 'focused' });
}
