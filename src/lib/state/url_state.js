import { base } from '$app/paths';

/**
 * The single place the URL is read and written.
 *
 * The URL carries the whole layout, so a link restores what you were looking
 * at rather than just which note was on top:
 *
 * ```
 * /<focused-slug>?tile=<slug>&tile=<slug>&focus=<n>&layout=<mode>&overlay=<kind>&q=<query>
 * ```
 *
 * - **path** is the focused tile's slug. Redundant with `tile`/`focus`, and
 *   deliberately so: it keeps the existing `[slug]` route, its `load`, and
 *   prerendering working untouched, and keeps the common one-note URL clean.
 * - **`tile`** is **repeated**, once per column, in order — not a comma-joined
 *   list. `toSlug` escapes only `~` and `-`, so a slug can legally contain a
 *   comma and a joined list would be ambiguous. Omitted entirely for a single
 *   tile.
 * - **`focus`** indexes that list; omitted when `0`.
 * - **`layout`** is `viz` or `content`; omitted for the `split` default, and
 *   also omitted under `/notes/`, whose pathname already means content-only.
 * - **`overlay`** and **`q`** describe the modal; omitted when it is closed.
 *
 * The `?onlyContent` / `?noContent` params this replaces are gone.
 *
 * @typedef {import('./layout.js').LayoutMode} LayoutMode
 * @typedef {import('./overlay.js').OverlayKind} OverlayKind
 * @typedef {{
 *   mode: LayoutMode,
 *   tileSlugs: string[],
 *   focusIndex: number,
 *   overlay: OverlayKind | null,
 *   query: string,
 * }} UrlState
 */

/** @type {LayoutMode[]} */
const MODES = ['split', 'viz', 'content'];
/** @type {OverlayKind[]} */
const KINDS = ['search', 'filter', 'commands'];

/** The note-only route. Its pathname *seeds* content mode rather than owning it. */
const NOTES_PREFIX = () => `${base}/notes/`;

/**
 * Search params are unavailable during prerender, where `url` is synthetic.
 * Reading them there would bake a build-time guess into every static page.
 *
 * @param {URL} url
 */
function params(url) {
  return typeof window !== 'undefined' ? url.searchParams : new URLSearchParams();
}

/**
 * The slug the pathname points at, or `null` for the index route.
 *
 * @param {URL} url
 * @returns {string | null}
 */
export function slugFromPath(url) {
  const path = url.pathname;
  if (path === `${base}/` || path === base || path === '') return null;
  const rest = path.startsWith(NOTES_PREFIX())
    ? path.slice(NOTES_PREFIX().length)
    : path.slice(`${base}/`.length);
  const slug = rest.replace(/\/$/, '');
  return slug === '' ? null : decodeURIComponent(slug);
}

/**
 * The path a note lives at. Everything that navigates goes through this, so
 * the `base` prefix cannot be forgotten (sub-path deploys break without it).
 *
 * @param {string} slug
 */
export function notePath(slug) {
  return `${base}/${encodeURIComponent(slug)}`;
}

/** The index route — bare visualization, no tiles. */
export function indexPath() {
  return `${base}/`;
}

/**
 * @param {URL} url
 * @returns {UrlState}
 */
export function readUrlState(url) {
  const search = params(url);
  const pathSlug = slugFromPath(url);
  const isNotesRoute = url.pathname.startsWith(NOTES_PREFIX());

  const rawMode = search.get('layout');
  /** @type {LayoutMode} */
  let mode = MODES.includes(/** @type {LayoutMode} */ (rawMode))
    ? /** @type {LayoutMode} */ (rawMode)
    : 'split';
  if (!rawMode && isNotesRoute) mode = 'content';

  let tileSlugs = search.getAll('tile').filter((s) => s !== '');
  if (tileSlugs.length === 0) tileSlugs = pathSlug ? [pathSlug] : [];

  const rawFocus = Number.parseInt(search.get('focus') ?? '0', 10);
  let focusIndex = Number.isFinite(rawFocus) ? rawFocus : 0;

  // The path wins over `?focus` when they disagree — it is the half of the URL
  // the router actually loaded a note for, so trusting anything else would
  // show a note the page data does not match.
  if (pathSlug !== null) {
    if (tileSlugs[focusIndex] !== pathSlug) {
      const at = tileSlugs.indexOf(pathSlug);
      if (at >= 0) {
        focusIndex = at;
      } else {
        tileSlugs = [pathSlug, ...tileSlugs];
        focusIndex = 0;
      }
    }
  }
  focusIndex = tileSlugs.length === 0 ? 0 : Math.min(Math.max(focusIndex, 0), tileSlugs.length - 1);

  const rawOverlay = search.get('overlay');
  const overlay = KINDS.includes(/** @type {OverlayKind} */ (rawOverlay))
    ? /** @type {OverlayKind} */ (rawOverlay)
    : null;

  return { mode, tileSlugs, focusIndex, overlay, query: search.get('q') ?? '' };
}

/**
 * Every param `buildUrl` owns, cleared before any is written. The last two are
 * legacy names from the pre-redesign content state, dropped so an old bookmark
 * does not leave a dead param wedged in the bar forever.
 */
const OWNED_PARAMS = ['tile', 'focus', 'layout', 'overlay', 'q', 'onlyContent', 'noContent'];

/**
 * Serialise state back into a URL.
 *
 * **Keeps `currentUrl.pathname` untouched.** Only the query string is ever
 * rewritten here, because the two directions have different history
 * semantics: a path change is a `goto` (it should be a back-button stop), a
 * query change is a `replaceState` (fiddling with the layout should not fill
 * up the history). Use `notePath()` for the former.
 *
 * **It is idempotent, and has to be**: `buildUrl(buildUrl(u, s), s)` must equal
 * `buildUrl(u, s)` *as a string*, because `WithAppState` decides whether to
 * call `replaceState` by comparing `href`s. That is why every owned param is
 * deleted up front and then written in one fixed order, rather than each being
 * `set`/`delete`d in place. `URLSearchParams` is order-sensitive in a way that
 * makes the in-place version silently non-idempotent: `delete` + `append` moves
 * a key to the *end*, while `set` keeps an existing key where it was. So
 * `?tile=a&tile=b&focus=1` — a URL this function had just written — came back
 * out as `?focus=1&tile=a&tile=b`, and the `href` compare reported a change on
 * a URL nothing had changed. At hydration that was fatal rather than merely
 * wasteful: see the `settled` gate in `WithAppState`.
 *
 * Params this app does not own keep their relative order and stay in front.
 *
 * @param {URL} currentUrl
 * @param {UrlState} state
 * @returns {URL}
 */
export function buildUrl(currentUrl, state) {
  const url = new URL(currentUrl);
  const search = url.searchParams;

  for (const key of OWNED_PARAMS) search.delete(key);

  // Omitted for a single tile: the pathname already names it.
  if (state.tileSlugs.length > 1) {
    for (const slug of state.tileSlugs) search.append('tile', slug);
    if (state.focusIndex > 0) search.set('focus', String(state.focusIndex));
  }

  // `/notes/<slug>` already means content-only; spelling it out again would
  // add a param the user never asked for to every note-only URL.
  const impliedByPath = url.pathname.startsWith(NOTES_PREFIX()) && state.mode === 'content';
  if (state.mode !== 'split' && !impliedByPath) search.set('layout', state.mode);

  if (state.overlay) {
    search.set('overlay', state.overlay);
    if (state.query) search.set('q', state.query);
  }

  return url;
}
