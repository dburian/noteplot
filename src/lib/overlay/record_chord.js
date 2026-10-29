import { chordFromEvent } from '$lib/commands/chord.js';

/**
 * Capture the next key chord pressed while `node` has focus.
 *
 * The listener is on `window` in the **capture** phase and stops propagation,
 * so `AppShell`'s window handler — which listens in the bubble phase — never
 * sees the keypress. That is what lets Escape, Ctrl+K or any other bound chord
 * be recorded instead of closing the overlay or opening search.
 *
 * Every chord is recordable, Escape included, except bare Tab / Shift+Tab: they
 * move focus as usual, and losing focus cancels. So does any click elsewhere.
 *
 * @param {HTMLElement} node focused on mount
 * @param {{onChord: (chord: string) => void, onCancel: () => void}} params
 */
export function recordChord(node, params) {
  let { onChord, onCancel } = params;

  /** @param {KeyboardEvent} ev */
  function onKeydown(ev) {
    if (ev.key === 'Tab' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) return;
    ev.preventDefault();
    ev.stopPropagation();
    const chord = chordFromEvent(ev);
    // A bare modifier is the start of a chord, not one.
    if (chord) onChord(chord);
  }

  function onBlur() {
    onCancel();
  }

  window.addEventListener('keydown', onKeydown, { capture: true });
  node.addEventListener('blur', onBlur);
  node.focus();

  return {
    /** @param {{onChord: (chord: string) => void, onCancel: () => void}} next */
    update(next) {
      ({ onChord, onCancel } = next);
    },
    destroy() {
      window.removeEventListener('keydown', onKeydown, { capture: true });
      node.removeEventListener('blur', onBlur);
    }
  };
}
