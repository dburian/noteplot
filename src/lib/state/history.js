import { writable } from 'svelte/store';
import { readStored, writeStored } from './persist.js';

/**
 * @typedef {{slug: string, title: string}} NoteRef
 * @typedef {{recent: NoteRef[]}} HistoryState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<HistoryState>['subscribe'],
 *   push: (note: NoteRef | null) => void,
 *   clear: () => void,
 * }} HistoryStore
 */

export const HISTORY_MAX = 8;
const STORAGE_KEY = 'noteplot:history';

/**
 * The last few notes viewed, most recent first, deduped by slug.
 *
 * Persisted to **session** storage, not local: this is "what I have been
 * looking at just now". A list restored from last week is noise in a strip
 * whose whole value is being a one-click hop back.
 *
 * @returns {HistoryStore}
 */
export function createHistoryState() {
  const stored = readStored('session', STORAGE_KEY, /** @type {NoteRef[]} */ ([]));
  const initial = Array.isArray(stored) ? stored.slice(0, HISTORY_MAX) : [];

  const { subscribe, update } = writable(/** @type {HistoryState} */ ({ recent: initial }));

  /** @param {NoteRef | null} note */
  function push(note) {
    if (!note) return;
    update((values) => {
      if (values.recent[0]?.slug === note.slug) return values;
      const recent = [note, ...values.recent.filter((n) => n.slug !== note.slug)].slice(
        0,
        HISTORY_MAX
      );
      writeStored('session', STORAGE_KEY, recent);
      return { recent };
    });
  }

  function clear() {
    writeStored('session', STORAGE_KEY, []);
    update(() => ({ recent: [] }));
  }

  return { subscribe, push, clear };
}
