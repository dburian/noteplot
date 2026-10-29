/**
 * Key chords: the string a shortcut is stored and looked up as.
 *
 * A chord is modifiers in a fixed order, then the key, joined by `+`:
 * `Mod+K`, `Mod+Shift+F`, `Mod+\`, `/`, `Escape`. The fixed order is what makes
 * a chord a usable `Map` key — the same keypress always produces the same
 * string, whichever modifier went down first.
 *
 * - **`Mod` is Ctrl _or_ Cmd.** One modifier for both, so a binding written on
 *   Linux works on a Mac and vice versa. Holding both is still just `Mod`.
 * - **The key is `ev.key`, lower-cased.** With Shift held, `ev.key` is the
 *   upper-case letter, and `Mod+Shift+F` must not depend on which case arrived.
 * - **Shift is dropped for a non-letter character.** On many layouts a symbol
 *   needs Shift to type at all — `/` is Shift+ú on Czech — and the character
 *   already says which symbol it is. Without this, `/` would be a different
 *   chord on a Czech keyboard than on a US one.
 *
 * Pure: no DOM beyond reading the event, no Svelte.
 */

/** Keys that are only ever a modifier; pressed alone they are not a chord. */
const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'OS', 'Hyper']);

/**
 * @param {KeyboardEvent} ev
 * @returns {string | null} the chord, or `null` for a bare modifier keydown
 */
export function chordFromEvent(ev) {
  if (MODIFIER_KEYS.has(ev.key) || ev.key === 'Dead' || ev.key === 'Unidentified') return null;

  let key = ev.key === ' ' ? 'Space' : ev.key;
  const printable = key.length === 1;
  if (printable) key = key.toLowerCase();
  const letter = printable && key.toUpperCase() !== key;

  const parts = [];
  if (ev.ctrlKey || ev.metaKey) parts.push('Mod');
  if (ev.altKey) parts.push('Alt');
  if (ev.shiftKey && (letter || !printable)) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

/** @returns {boolean} */
function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** @type {Record<string, string>} */
const KEY_NAMES = {
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵'
};

/**
 * A chord as a person reads it: `Ctrl+Shift+F` on Linux and Windows, `⌘⇧F` on
 * a Mac. Display only — never parse this back.
 *
 * @param {string} chord
 * @returns {string}
 */
export function formatChord(chord) {
  const parts = chord.split('+');
  // `Mod++` is a chord on the `+` key itself; splitting leaves two empties.
  const key = chord.endsWith('++') ? '+' : parts[parts.length - 1];
  const mods = chord.endsWith('++') ? parts.slice(0, -2) : parts.slice(0, -1);
  const keyName = KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);

  if (isMac()) {
    /** @type {Record<string, string>} */
    const glyph = { Mod: '⌘', Alt: '⌥', Shift: '⇧' };
    return mods.map((m) => glyph[m] ?? m).join('') + keyName;
  }
  /** @type {Record<string, string>} */
  const name = { Mod: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
  return [...mods.map((m) => name[m] ?? m), keyName].join('+');
}
