/**
 * Keep Tab inside the overlay.
 *
 * The modal fills the content pane and is opaque, so the tiles behind it are
 * invisible but still in the DOM and still tabbable — without this, Tab walks
 * out of a dialog that claims `aria-modal="true"` and into a note nobody can
 * see.
 *
 * **It focuses nothing on mount, deliberately.** `SearchBar`'s own `onMount`
 * autofocus owns the initial focus; a second claimant here would race it and
 * whichever ran last would win. Focus *restore* is not here either — that is
 * `OverlayShell`, which captures the outgoing element at component init, before
 * any child has had the chance to take focus.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * @param {HTMLElement} node
 * @returns {{destroy: () => void}}
 */
export function focusTrap(node) {
  /** @param {KeyboardEvent} ev */
  function onKeydown(ev) {
    if (ev.key !== 'Tab') return;

    // Queried per keypress rather than cached: the list changes as you type —
    // rows appear and disappear, and a disabled command drops out of it.
    const targets = /** @type {HTMLElement[]} */ ([...node.querySelectorAll(FOCUSABLE)]).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (targets.length === 0) return;

    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;

    // Also covers focus having escaped already (activeElement outside `node`),
    // which is how a stray click on the toolbar leaves things.
    if (ev.shiftKey && (active === first || !node.contains(active))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (active === last || !node.contains(active))) {
      ev.preventDefault();
      first.focus();
    }
  }

  node.addEventListener('keydown', onKeydown);

  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown);
    }
  };
}
