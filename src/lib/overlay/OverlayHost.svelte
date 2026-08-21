<script>
  import { useAppState, OVERLAY } from '$lib/state/keys.js';
  import OverlayShell from './OverlayShell.svelte';
  import SearchOverlay from './SearchOverlay.svelte';
  import FilterOverlay from './FilterOverlay.svelte';
  import CommandOverlay from './CommandOverlay.svelte';

  /**
   * The one mount point for all three modals, in `ContentPane`.
   *
   * Nothing outside `overlay.js` decides what is open: the toolbar buttons, the
   * keyboard shortcuts, the commands and `?overlay=` all write `kind`, and this
   * reads it. Adding a fourth screen is a key in `OverlayKind` and a row in the
   * two maps below.
   *
   * `<svelte:component>` remounts on every change of `this`, which is what
   * makes each screen's `onMount` autofocus fire on open and its state start
   * clean.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );

  const SCREENS = {
    search: SearchOverlay,
    filter: FilterOverlay,
    commands: CommandOverlay
  };

  const TITLES = {
    search: 'Search notes',
    filter: 'Filter notes',
    commands: 'Command palette'
  };
</script>

{#if $overlay.kind}
  <OverlayShell title={TITLES[$overlay.kind]} on:close={overlay.close}>
    <svelte:component this={SCREENS[$overlay.kind]} />
  </OverlayShell>
{/if}
