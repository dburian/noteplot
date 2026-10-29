import { writable } from 'svelte/store';
import { readStored, writeStored } from './persist.js';

/**
 * @typedef {{activeId: string, settings: Record<string, Record<string, unknown>>}} VizState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<VizState>['subscribe'],
 *   setActive: (id: string) => void,
 *   updateSettings: (id: string, patch: Record<string, unknown>) => void,
 * }} VizStore
 */

const STORAGE_KEY = 'noteplot:viz';

/**
 * Which visualization is showing, and each one's own settings.
 *
 * The per-visualization slice is what keeps renderer settings out of the
 * app-wide stores: `showConnections` and `showTagsGlow` belong to the force
 * graph alone and used to sit in the same object as `activeNote`, which
 * belongs to nothing in particular.
 *
 * Takes the descriptor list rather than importing the registry, so the state
 * layer does not depend on the visualization layer.
 *
 * @param {{id: string, defaultSettings?: Record<string, unknown>}[]} descriptors
 * @returns {VizStore}
 */
export function createVizState(descriptors) {
  /** @type {Record<string, Record<string, unknown>>} */
  const defaults = {};
  for (const d of descriptors) defaults[d.id] = { ...(d.defaultSettings ?? {}) };

  const stored = readStored('local', STORAGE_KEY, /** @type {Partial<VizState>} */ ({}));
  const knownId = descriptors.some((d) => d.id === stored.activeId);

  /** @type {VizState} */
  const initial = {
    activeId: knownId && stored.activeId ? stored.activeId : descriptors[0]?.id ?? '',
    // Per-key merge, not a top-level spread: a stored blob written before a
    // setting existed must not shadow that setting's new default.
    settings: Object.fromEntries(
      Object.entries(defaults).map(([id, def]) => [
        id,
        { ...def, ...(stored.settings?.[id] ?? {}) }
      ])
    )
  };

  const { subscribe, update } = writable(initial);

  /** @param {(values: VizState) => VizState} fn */
  function write(fn) {
    update((values) => {
      const next = fn(values);
      if (next !== values) writeStored('local', STORAGE_KEY, next);
      return next;
    });
  }

  /** @param {string} id */
  function setActive(id) {
    write((values) => (values.activeId === id ? values : { ...values, activeId: id }));
  }

  /** @param {string} id @param {Record<string, unknown>} patch */
  function updateSettings(id, patch) {
    write((values) => ({
      ...values,
      settings: { ...values.settings, [id]: { ...(values.settings[id] ?? {}), ...patch } }
    }));
  }

  return { subscribe, setActive, updateSettings };
}
