<script>
  import { tick } from 'svelte';

  import { useAppState, OVERLAY } from '$lib/state/keys.js';
  import SearchOverlay from './SearchOverlay.svelte';
  import FilterOverlay from './FilterOverlay.svelte';
  import CommandOverlay from './CommandOverlay.svelte';

  /**
   * The one mount point for all three modals, in `ContentPane`.
   *
   * Nothing outside `overlay.js` decides what is open: the toolbar buttons, the
   * keyboard shortcuts, the commands and `?overlay=` all write `kind`, and this
   * reads it. Adding a fourth screen is a key in `OverlayKind` and a row in the
   * map below.
   *
   * `<svelte:component>` remounts on every change of `this`, which is what
   * makes each screen's `onMount` autofocus fire on open and its state start
   * clean.
   *
   * **Each screen mounts its own `OverlayShell`** and passes its own title.
   * This used to wrap the `<svelte:component>` in one shell from here, which
   * cannot work now that the shell has named slots: slot content is scoped to
   * where it is written, so a screen rendered as a child could never fill the
   * shell's `input` and `footer` slots. Moving the shell inward costs one line
   * per screen and keeps the remount behaviour above intact.
   *
   * **Focus restore lives here** rather than in the shell, for that same
   * reason: this `{#if}` stays true while `kind` changes from one screen to
   * another, so it is the only thing in the overlay stack that spans a whole
   * *open*. Tab containment is still the shell's, via `focus_trap.js`.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );

  const SCREENS = {
    search: SearchOverlay,
    filter: FilterOverlay,
    commands: CommandOverlay
  };

  /**
   * Whatever had focus when the overlay opened — a toolbar button, or nothing
   * at all if a shortcut opened it.
   *
   * @type {HTMLElement | null}
   */
  let opener = null;

  $: captureOrRestore($overlay.kind);

  /** @param {string | null} kind */
  function captureOrRestore(kind) {
    // Runs during prerender too, where there is no document and `kind` is
    // always null anyway.
    if (typeof document === 'undefined') return;

    if (kind) {
      // Svelte runs reactive statements *before* it patches the DOM, so at this
      // point the overlay does not exist yet and `activeElement` is still the
      // control that opened it. The `!opener` guard is what makes switching
      // screens mid-session keep the original opener rather than capturing the
      // outgoing screen's input.
      if (opener) return;
      const el = document.activeElement;
      opener = el instanceof HTMLElement && el !== document.body ? el : null;
      return;
    }

    const el = opener;
    opener = null;
    // After the teardown, or focus would land on an element the overlay is
    // about to paint over. `preventScroll` because the content pane is
    // re-laying-out behind us and owns its own scroll positions.
    if (el) tick().then(() => el.isConnected && el.focus({ preventScroll: true }));
  }
</script>

{#if $overlay.kind}
  <svelte:component this={SCREENS[$overlay.kind]} />
{/if}
