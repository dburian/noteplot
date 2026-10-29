import { derived, get, writable } from 'svelte/store';
import { readStored, writeStored } from './persist.js';

/**
 * @typedef {{id: string, defaultKeys?: string[]}} Bindable
 * @typedef {Record<string, string[]>} Overrides
 * @typedef {{
 *   bindings: Record<string, string[]>,
 *   byChord: Map<string, string>,
 *   overrides: Overrides,
 * }} ShortcutsState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<ShortcutsState>['subscribe'],
 *   add: (id: string, chord: string) => string | null,
 *   remove: (id: string, chord: string) => void,
 *   reset: (id: string) => void,
 *   resetAll: () => void,
 * }} ShortcutsStore
 */

const STORAGE_KEY = 'noteplot:shortcuts';

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function sameSet(a, b) {
  return a.length === b.length && a.every((chord) => b.includes(chord));
}

/**
 * The keyboard shortcuts: which chords run which command.
 *
 * **Only the user's overrides are stored**, `{[commandId]: chords}`, never the
 * resolved table. A command nobody rebound keeps tracking its `defaultKeys` in
 * `commands/registry.js`, so changing a default in code reaches everyone who
 * did not touch it. An override that comes to equal the default is dropped for
 * the same reason, and so is one naming a command that no longer exists.
 *
 * **A chord belongs to at most one command.** `add` takes it away from its
 * previous owner and returns that owner's id, so the settings screen can say
 * where it went. `byChord` is the lookup `AppShell` runs on every keydown.
 *
 * Local storage, like `prefs.js`: a binding is a decision.
 *
 * @param {Bindable[]} commands the registry — passed in, like the viz descriptors
 * @returns {ShortcutsStore}
 */
export function createShortcutsState(commands) {
  /** @type {Record<string, string[]>} */
  const defaults = Object.fromEntries(commands.map((c) => [c.id, c.defaultKeys ?? []]));

  /** @param {unknown} raw @returns {Overrides} */
  function sanitise(raw) {
    /** @type {Overrides} */
    const clean = {};
    if (!raw || typeof raw !== 'object') return clean;
    for (const [id, chords] of Object.entries(raw)) {
      if (!(id in defaults) || !Array.isArray(chords)) continue;
      clean[id] = chords.filter((c) => typeof c === 'string' && c !== '');
    }
    return clean;
  }

  const overrides = writable(sanitise(readStored('local', STORAGE_KEY, {})));

  const state = derived(overrides, ($overrides) => {
    /** @type {Record<string, string[]>} */
    const bindings = {};
    /** @type {Map<string, string>} */
    const byChord = new Map();
    for (const { id } of commands) {
      // First owner wins, so a stale override colliding with a default cannot
      // make one chord run two commands.
      bindings[id] = ($overrides[id] ?? defaults[id]).filter((chord) => !byChord.has(chord));
      for (const chord of bindings[id]) byChord.set(chord, id);
    }
    return { bindings, byChord, overrides: $overrides };
  });

  /**
   * Set the full chord list of each command in `changes`.
   *
   * @param {Record<string, string[]>} changes
   */
  function write(changes) {
    overrides.update((values) => {
      const next = { ...values };
      for (const [id, chords] of Object.entries(changes)) {
        if (sameSet(chords, defaults[id])) delete next[id];
        else next[id] = chords;
      }
      writeStored('local', STORAGE_KEY, next);
      return next;
    });
  }

  /**
   * @param {string} id
   * @param {string} chord
   * @returns {string | null} the command the chord was taken from, if any
   */
  function add(id, chord) {
    const { bindings, byChord } = get(state);
    const owner = byChord.get(chord) ?? null;
    if (owner === id) return null;

    /** @type {Record<string, string[]>} */
    const changes = { [id]: [...bindings[id], chord] };
    if (owner) changes[owner] = bindings[owner].filter((c) => c !== chord);
    write(changes);
    return owner;
  }

  /**
   * @param {string} id
   * @param {string} chord
   */
  function remove(id, chord) {
    const { bindings } = get(state);
    write({ [id]: bindings[id].filter((c) => c !== chord) });
  }

  /**
   * Back to the defaults. A default chord some other command has since taken
   * stays with that command — `derived` hands it to whoever comes first in the
   * registry, so take it back explicitly.
   *
   * @param {string} id
   */
  function reset(id) {
    const { bindings, byChord } = get(state);
    /** @type {Record<string, string[]>} */
    const changes = { [id]: defaults[id] };
    for (const chord of defaults[id]) {
      const owner = byChord.get(chord);
      if (owner && owner !== id) {
        changes[owner] = (changes[owner] ?? bindings[owner]).filter((c) => c !== chord);
      }
    }
    write(changes);
  }

  function resetAll() {
    overrides.set({});
    writeStored('local', STORAGE_KEY, {});
  }

  return { subscribe: state.subscribe, add, remove, reset, resetAll };
}
