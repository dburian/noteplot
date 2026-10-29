import { writable } from 'svelte/store';
import { readStored, writeStored } from './persist.js';

/**
 * @typedef {{showMeta: boolean}} PrefsState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<PrefsState>['subscribe'],
 *   setShowMeta: (flag: boolean) => void,
 *   toggleMeta: () => void,
 * }} PrefsStore
 */

const STORAGE_KEY = 'noteplot:prefs';

/** @type {PrefsState} */
const DEFAULTS = { showMeta: true };

/**
 * Sticky user preferences. **Local** storage, unlike the view history: a
 * preference is a decision, and re-making it every session is the annoyance
 * the setting exists to remove.
 *
 * @returns {PrefsStore}
 */
export function createPrefsState() {
  const stored = readStored('local', STORAGE_KEY, DEFAULTS);
  const { subscribe, update } = writable({ ...DEFAULTS, ...stored });

  /** @param {(values: PrefsState) => PrefsState} fn */
  function write(fn) {
    update((values) => {
      const next = fn(values);
      writeStored('local', STORAGE_KEY, next);
      return next;
    });
  }

  /** @param {boolean} flag */
  function setShowMeta(flag) {
    write((values) => (values.showMeta === flag ? values : { ...values, showMeta: flag }));
  }

  function toggleMeta() {
    write((values) => ({ ...values, showMeta: !values.showMeta }));
  }

  return { subscribe, setShowMeta, toggleMeta };
}
