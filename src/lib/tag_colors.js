/**
 * @typedef {{light: string, dark: string}} TagColor
 */

/**
 * One colour per tag, shared by every visualization and the note header.
 *
 * Hues are spaced evenly round the wheel over **every** tag in the
 * collection, **sorted**, so a tag has the same colour in every graph and next
 * to the note's title. Each graph used to space hues over its own nodes' tags
 * in the order it met them, so one tag could be green in the force graph and
 * blue in the date graph -- and a colour in the note pane could not have
 * matched "the" graph's.
 *
 * `light` and `dark` differ only in saturation (30% / 50%), as the glow always
 * has. The alpha the glow's `hsla()` used to carry was dropped by `formatHex()`,
 * so these are opaque, as the glow always was.
 *
 * @param {{matter?: Record<string, any>}[]} notes `index.json`'s entries
 * @returns {Map<string, TagColor>}
 */
export function createTagColors(notes) {
  const tags = new Set();
  for (const note of notes) {
    const noteTags = note.matter?.tags;
    if (!Array.isArray(noteTags)) continue;
    for (const tag of noteTags) tags.add(String(tag));
  }

  const sorted = [...tags].sort();
  const step = 360 / Math.max(sorted.length, 1);

  /** @type {Map<string, TagColor>} */
  const colors = new Map();
  sorted.forEach((tag, i) => {
    const hue = i * step;
    colors.set(tag, { light: hslHex(hue, 0.3, 0.5), dark: hslHex(hue, 0.5, 0.5) });
  });
  return colors;
}

/**
 * HSL to `#rrggbb` -- the standard conversion, rounded the way d3's
 * `formatHex()` rounds, so the colours match what the glow drew before.
 *
 * @param {number} h degrees
 * @param {number} s 0..1
 * @param {number} l 0..1
 */
function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  /** @param {number} n */
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
