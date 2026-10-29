/**
 * The one highlight treatment shared by every overlay row.
 *
 * `SearchMatch` and the command palette's rows are different elements — an
 * `<a href>` and a `<button>` — but they are the same control, and the class
 * pair was copied between them. One copy, here.
 *
 * These must stay **literal strings**: Tailwind's content scanner reads this
 * file (`tailwind.config.js`'s glob covers `.js`) but cannot see a class name
 * that is computed. Padding is deliberately *not* here — the two rows differ,
 * and per the stylesheet-order trap documented in `src/lib/CLAUDE.md` a
 * competing `px-*` passed alongside would silently lose.
 */

const ROW_BASE = 'block w-full text-left border-l-2 no-underline';

const ROW_ACTIVE =
  'border-l-emphasis-light dark:border-l-emphasis-dark bg-muted-light/20 dark:bg-muted-dark/20';

const ROW_IDLE = 'border-l-transparent hover:bg-muted-light/10 dark:hover:bg-muted-dark/10';

/**
 * @param {boolean} active whether ↑/↓ has this row under the cursor
 * @returns {string}
 */
export function rowClass(active) {
  return `${ROW_BASE} ${active ? ROW_ACTIVE : ROW_IDLE}`;
}
