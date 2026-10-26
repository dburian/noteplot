import { get } from 'svelte/store';

import { useAppState, FILTER, LAYOUT, OVERLAY, PREFS, TILES, VIZ } from '$lib/state/keys.js';

/**
 * The `CommandContext` for code that runs a command *once*, on an event —
 * `AppShell`'s shortcut handler. Call at component init, like `useAppState`.
 *
 * `values` is read with `get()` at the moment the command runs, so it is never
 * stale and nothing has to subscribe. `CommandOverlay` does not use this: it
 * needs `values` to be reactive, so the list greys out a command the moment it
 * stops being available.
 *
 * @returns {() => import('./registry.js').CommandContext}
 */
export function useCommandContext() {
  const stores = {
    layout: /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT)),
    tiles: /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES)),
    prefs: /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS)),
    viz: /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ)),
    filter: /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER)),
    overlay: /** @type {import('$lib/state/overlay.js').OverlayStore} */ (useAppState(OVERLAY))
  };

  return () => ({
    ...stores,
    values: {
      layout: get(stores.layout),
      tiles: get(stores.tiles),
      prefs: get(stores.prefs),
      viz: get(stores.viz),
      filter: get(stores.filter),
      overlay: get(stores.overlay)
    }
  });
}
