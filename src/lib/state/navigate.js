/**
 * Open a note — the one entry point every navigation source funnels through:
 * a canvas click, a history chip, a search result, a filter result. (A prose
 * link is the exception, and not one of these: it is an un-intercepted `<a>`,
 * so `WithAppState`'s `afterNavigate` picks it up with a bare `tiles.open`.)
 *
 * It is only the *tile* half, plus the layout nudge below. The navigation half
 * is not here and must not be added back: `WithAppState` watches the focused
 * tile and rewrites the path whenever the two disagree, so a `goto` at this
 * call site would be a second one for the same change and would push a
 * duplicate history entry.
 *
 * That split is what makes closing a column, splitting one, and clicking into
 * another all update the URL for free — none of them go through here, and all
 * of them move focus. It also makes re-opening the note already in the focused
 * tile a genuine no-op *for the tiles store*: it does not change, so nothing
 * navigates. `layout.reveal()` still runs, which is the point — clicking the
 * node of the note already in the hidden focused tile has to show it to you.
 *
 * `layout` is a required positional parameter rather than a field on `opts`
 * precisely so it cannot be forgotten: with `checkJs` on, a call site left
 * un-updated passes a `string` where a `LayoutStore` is expected and
 * `npm run check` names it. An optional field would be silently omitted, which
 * is the failure mode this shared helper exists to prevent.
 *
 * Both store writes land in the same tick, so Svelte batches them into one
 * `replaceState` from the stores → URL block in `WithAppState`.
 *
 * @param {import('./tiles.js').TilesStore} tiles
 * @param {import('./layout.js').LayoutStore} layout
 * @param {string} slug
 * @param {{where?: 'focused'|'new'}} [opts]
 */
export function openNote(tiles, layout, slug, opts = {}) {
  layout.reveal();
  tiles.open(slug, { where: opts.where ?? 'focused' });
}
