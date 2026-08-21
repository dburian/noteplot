import { writable } from 'svelte/store';

/**
 * @typedef {{slug: string, title: string}} NoteRef
 * @typedef {{activeNote: NoteRef | null, hoveredNote: NoteRef | null}} SelectionState
 * @typedef {{
 *   subscribe: import('svelte/store').Readable<SelectionState>['subscribe'],
 *   setActive: (note: NoteRef | null) => void,
 *   hover: (note: NoteRef | null) => void,
 * }} SelectionStore
 */

/**
 * Only the slug and the title are ever read off a note here. Keeping the whole
 * note would put its rendered HTML in the store (ISSUES.md B9).
 *
 * @param {{slug: string, title: string} | null | undefined} note
 * @returns {NoteRef | null}
 */
export function toNoteRef(note) {
  return note ? { slug: note.slug, title: note.title } : null;
}

/**
 * "Which note matters right now" — app-wide, not visualization-specific.
 * `activeNote` follows the focused tile; `hoveredNote` is written from both
 * ends (the canvas writes it on pointermove, prose links write it on
 * mouseenter, and both read it back to highlight).
 *
 * @param {NoteRef | null} [initialActive]
 * @returns {SelectionStore}
 */
export function createSelectionState(initialActive = null) {
  const { subscribe, update } = writable(
    /** @type {SelectionState} */ ({ activeNote: initialActive, hoveredNote: null })
  );

  /** @param {NoteRef | null} note */
  function setActive(note) {
    update((values) => {
      if (note?.slug === values.activeNote?.slug) return values;
      return { ...values, activeNote: note };
    });
  }

  /**
   * Returns the state object *untouched* when the hovered slug has not
   * actually changed, so no subscriber fires. `onHover` runs on every
   * pointermove over a node, and a fresh object each time meant a full graph
   * redraw every time (ISSUES.md C1). Do not "simplify" this to an
   * unconditional spread.
   *
   * @param {NoteRef | null} note
   */
  function hover(note) {
    update((values) => {
      if (note?.slug === values.hoveredNote?.slug) return values;
      return { ...values, hoveredNote: note };
    });
  }

  return { subscribe, setActive, hover };
}
