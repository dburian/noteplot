<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  import { useAppState, FILTER, SELECTION } from '$lib/state/keys.js';
  import { CanvasGraph } from './canvas_graph.js';

  /**
   * The force graph's `View`: a `<canvas>`, and an imperative `CanvasGraph`
   * built over it once. Svelte reactivity stops at that boundary — everything
   * below is plain JS reading stores directly, because the graph redraws on
   * every zoom, hover and filter change and components are the wrong shape for
   * that.
   *
   * The canvas is `absolute inset-0` inside a `relative` box on purpose.
   * `CanvasScreen` measures the canvas element and resizes only its backing
   * store, so the element's CSS size has to come from the parent — a canvas
   * that sized itself would make the `ResizeObserver` watch its own output.
   */

  /** `{nodes, links, viewBox, timeAxis?}` from `generated/viz/<dataId>.json`. Read once, at mount. @type {any} */
  export let data;
  /** @type {import('./canvas_graph.js').ForceGraphSettings} */
  export let settings;
  /**
   * `{onActivate(slug), onHover(node)}`, supplied by `VizPane`. Captured once
   * at mount like everything else here, so it must be a stable object.
   *
   * @type {{onActivate: (slug: string) => void, onHover: (node: any) => void}}
   */
  export let callbacks;

  /** @type {HTMLCanvasElement} */
  let canvas;

  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );
  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));

  /**
   * The one prop that has to keep flowing after mount. `CanvasGraph` has no
   * update path from props — it is built in `onMount` and subscribes to stores
   * — so the settings prop is bridged into a store rather than passed by value.
   * Toggling "Connections" in the toolbar writes `viz.updateSettings`, which
   * lands here as a new object and reaches the graph through this.
   */
  const settingsStore = writable(settings);
  $: settingsStore.set(settings);

  onMount(() => {
    const graph = new CanvasGraph({
      nodes: data.nodes ?? [],
      links: data.links ?? [],
      viewBox: data.viewBox,
      canvas,
      selection,
      filter,
      settings: settingsStore,
      onActivate: callbacks.onActivate,
      onHover: callbacks.onHover,
      // Only the date graph's file has them; they turn on the date axes.
      timeAxes: data.timeAxes ?? null
    });

    return () => graph.destruct();
  });
</script>

<div class="relative h-full w-full">
  <canvas
    bind:this={canvas}
    class="absolute inset-0 h-full w-full touch-none bg-back-light dark:bg-back-dark"
  ></canvas>
</div>
