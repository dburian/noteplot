import { tick } from 'svelte';
import { afterNavigate, beforeNavigate } from '$app/navigation';

/**
 * Manual scroll restoration for the content pane's tiles.
 *
 * SvelteKit's own restoration is inert here: it scrolls the *window*, and the
 * window never scrolls in this app — every tile is its own
 * `overflow-y-auto` box. So back/forward has to be implemented by hand.
 *
 * The other half of the fix is structural and lives in `Tile.svelte`: the
 * `{#key tile.slug}` sits *inside* the scroll container. It used to be the
 * other way round (`note/Note.svelte` wrapped its `overflow-auto h-screen` div
 * in `{#key ...slug}`), which destroyed and recreated the scroller on every
 * navigation — there was nothing left to restore a position onto.
 *
 * @typedef {{
 *   register: (id: string, el: HTMLElement) => () => void,
 *   hold: () => () => Promise<void>,
 * }} ScrollMemory
 */

/**
 * How many history entries keep their positions. A long session walking a note
 * graph produces one entry per click; without a cap the map grows for as long
 * as the tab is open.
 */
const MAX_ENTRIES = 50;

/**
 * The history entry currently on screen.
 *
 * SvelteKit stamps every entry it pushes with `sveltekit:index`, a monotonic
 * counter, which is the only thing that distinguishes two visits to the *same*
 * URL — and telling those apart is most of the point. `href` is the fallback
 * for the very first entry, which predates the router.
 */
function currentKey() {
  if (typeof history === 'undefined') return '';
  return String(history.state?.['sveltekit:index'] ?? window.location.href);
}

/**
 * Call during component initialisation — it registers `beforeNavigate` and
 * `afterNavigate`, which are only legal there.
 *
 * @param {{focusedId: () => string | null}} opts
 *   `focusedId` is read lazily, at navigation time, rather than passed as a
 *   value: the focused tile on arrival is not the one that was focused when
 *   this was called.
 * @returns {ScrollMemory}
 */
export function createScrollMemory(opts) {
  /** Positions per history entry: `Map<historyKey, Map<tileId, scrollTop>>`. */
  const byEntry = new Map();

  /** The scroll containers currently mounted, by tile id. @type {Map<string, HTMLElement>} */
  const scrollers = new Map();

  /**
   * A tile hands over its scroll container and gets back a de-registration
   * function. Keyed by tile id, which is why `tiles.js` mints ids from a
   * counter and `tiles.reconcile` preserves them: a fresh id on every
   * navigation would invalidate the memory on exactly the back presses it
   * exists to serve.
   *
   * @param {string} id @param {HTMLElement} el
   */
  function register(id, el) {
    scrollers.set(id, el);
    return () => {
      if (scrollers.get(id) === el) scrollers.delete(id);
    };
  }

  /**
   * Snapshot every mounted tile under the entry we are *leaving*. Runs in
   * `beforeNavigate`, while `history.state` still describes that entry.
   *
   * Re-inserting the key rather than overwriting it in place is deliberate:
   * `Map` iterates in insertion order, so this keeps the eviction below
   * least-recently-used instead of oldest-first.
   */
  function snapshot() {
    const key = currentKey();
    // While the pane is hidden its boxes do not exist and every `scrollTop`
    // reads `0`; the hold is the only record of where the tiles actually were.
    const positions = held ? new Map(held) : measure();

    byEntry.delete(key);
    byEntry.set(key, positions);

    while (byEntry.size > MAX_ENTRIES) {
      byEntry.delete(byEntry.keys().next().value);
    }
  }

  /**
   * Every mounted tile's current offset, read from the DOM.
   *
   * @returns {Map<string, number>}
   */
  function measure() {
    /** @type {Map<string, number>} */
    const positions = new Map();
    for (const [id, el] of scrollers) positions.set(id, el.scrollTop);
    return positions;
  }

  /**
   * The outstanding `hold()`'s offsets while the pane is hidden, or `null`.
   *
   * It doubles as the "the pane is hidden" flag for the two navigation
   * handlers, which cannot get at the tiles' real offsets in that state — the
   * boxes have no layout, so reading `scrollTop` yields `0` and writing it does
   * nothing.
   *
   * @type {Map<string, number> | null}
   */
  let held = null;

  /**
   * Snapshot the mounted tiles' offsets *now* and return the function that puts
   * them back. Unlike `snapshot`, it is not keyed by a history entry — nothing
   * is navigating.
   *
   * It is for hiding the pane. `AppShell` hides rather than unmounts, but
   * `display:none` still destroys the scroll boxes, and a box that has just been
   * recreated is at the top. The restore is behind `await tick()` for the same
   * reason the one below is: the content has to lay out before an offset means
   * anything.
   *
   * @returns {() => Promise<void>}
   */
  function hold() {
    const positions = measure();
    held = positions;

    return async () => {
      held = null;
      await tick();
      for (const [id, top] of positions) {
        const el = scrollers.get(id);
        if (el) el.scrollTop = top;
      }
    };
  }

  beforeNavigate(snapshot);

  afterNavigate(async (ev) => {
    const positions = ev.type === 'popstate' ? byEntry.get(currentKey()) : null;

    // Navigating while the pane is hidden — clicking a graph node in `viz`
    // mode, most obviously. Writing to the boxes would do nothing, and the
    // hold would then put the *pre-navigation* offsets back on top of notes
    // that have since changed. Amend the hold instead; it is what will be
    // applied when the pane comes back.
    if (held) {
      if (positions) {
        held.clear();
        for (const [id, top] of positions) held.set(id, top);
      } else {
        const id = opts.focusedId();
        if (id !== null) held.set(id, 0);
      }
      return;
    }

    // The new content is in the DOM but has not laid out yet; assigning
    // `scrollTop` before it has means clamping to a height that is still zero.
    await tick();

    if (positions) {
      for (const [id, top] of positions) {
        const el = scrollers.get(id);
        if (el) el.scrollTop = top;
      }
      return;
    }

    // Any other navigation is a *new* view of a note, and a new view starts at
    // the top. Only the focused tile moves — the others still show what they
    // showed, at the offset they showed it.
    const id = opts.focusedId();
    if (id === null) return;
    const el = scrollers.get(id);
    if (el) el.scrollTop = 0;
  });

  return { register, hold };
}
