<script>
  import { useAppState, LAYOUT, VIZ } from '$lib/state/keys.js';
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
   * to affect) but the switcher stays, because it is the way back out.
   */

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));

  $: active = getVisualization($viz.activeId);
  $: showControls = $layout.mode !== 'content' && active.Controls !== null;
</script>

<div class="flex items-center gap-1 shrink-0">
  <VizSwitcher />
  {#if showControls}
    <div class="w-px h-5 mx-1 bg-muted-light dark:bg-muted-dark" aria-hidden="true"></div>
    <svelte:component this={active.Controls} />
  {/if}
</div>
