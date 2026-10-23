<script>
  import { useAppState, LAYOUT, OVERLAY, TILES, VIZ } from '$lib/state/keys.js';
  import { visibleMode } from '$lib/state/layout.js';
  import { getVisualization } from '$lib/viz/registry.js';
  import VizSwitcher from './VizSwitcher.svelte';

  /**
   * The visualization switcher and, after it, whatever controls the active
   * visualization contributes.
   *
   * `Controls` is `null` until Stage 4 registers the force graph's, so the
   * guard is not defensive padding — it is the only reason this renders today.
   *
   * In `content` mode the controls go away (there is nothing on screen for them
   * to affect) but the switcher stays, because it is the way back out. It is
   * the *visible* mode that counts: `content` with no note open shows the graph.
   */

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));

  $: active = getVisualization($viz.activeId);
  $: shown = visibleMode($layout.mode, $tiles.tiles.length > 0, !!$overlay.kind);
  $: showControls = shown !== 'content' && active.Controls !== null;
</script>

<div class="flex items-center gap-1 shrink-0">
  <VizSwitcher />
  {#if showControls}
    <div class="w-px h-5 mx-1 bg-muted-light dark:bg-muted-dark" aria-hidden="true"></div>
    <svelte:component this={active.Controls} />
  {/if}
</div>
