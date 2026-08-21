import { getContext } from 'svelte';

/**
 * Context keys, as constants rather than string literals.
 *
 * `getContext('typo')` returns `undefined`, and `{#if $store.foo}` on an
 * undefined store renders nothing at all — a whole bug class that costs an
 * afternoon each time (see the `ResizeContent` story in `src/lib/CLAUDE.md`).
 * Importing a constant turns a typo into a build error instead.
 *
 * All of these are set by `state/WithAppState.svelte`.
 */

export const NOTES_INDEX = 'noteplot:notesIndex';
export const SELECTION = 'noteplot:selection';
export const LAYOUT = 'noteplot:layout';
export const TILES = 'noteplot:tiles';
export const HISTORY = 'noteplot:history';
export const OVERLAY = 'noteplot:overlay';
export const PREFS = 'noteplot:prefs';
export const VIZ = 'noteplot:viz';
export const FILTER = 'noteplot:filter';

/**
 * Read one of the app contexts. Throws instead of returning `undefined`, so a
 * consumer mounted outside `WithAppState` fails loudly at init rather than
 * rendering an empty box.
 *
 * Must be called during component initialisation, like `getContext` itself.
 *
 * @template T
 * @param {string} key one of the constants above
 * @returns {T}
 */
export function useAppState(key) {
  const store = getContext(key);
  if (store === undefined) {
    throw new Error(
      `No provider for context "${key}". Is this component mounted under <WithAppState>?`
    );
  }
  return /** @type {T} */ (store);
}
