<script>
  import { getContext, setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';

  /**
   * Provides `contentSliderState`, the desktop-only "how wide is the content
   * pane" half of the content state. `contentState` remains the source of truth
   * for *whether* content shows; the two are bidirectionally synced by the
   * reactive block below, which is the trickiest state code in the repo — see
   * `src/lib/CLAUDE.md`.
   *
   * This lives one level above `ContentSlider.svelte`, which used to own it,
   * because `GraphCanvas` is a **sibling** of the slider and context only flows
   * down. The canvas needs the pane's width to keep the graph out from behind
   * it (ISSUES.md C13), and a sibling cannot `getContext` a key its sibling
   * sets.
   */

  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const DEFAULT_CONTENT_WIDTH = 1 - 1 / goldenRatio;

  /**
   * @param {URL} url
   * @param {Number} defaultWidth
   */
  function extractContentSliderStateFromUrl(url, defaultWidth, contentState) {
    const searchParams = typeof window !== 'undefined' ? url.searchParams : new Map();

    const state = {
      searchString: searchParams.get('q') || null,
      lastUrl: url,
      width: defaultWidth,
      lastSetWidth: defaultWidth
    };

    if (contentState.onlyContent) state.width = 1.0;
    else if (contentState.noContent || !contentState.hasContent) state.width = 0.0;
    return state;
  }

  /**
   * @param {URL} url
   */
  function createContentSliderState(url, contentStateInitValues, contentState) {
    const { subscribe, update } = writable(
      extractContentSliderStateFromUrl(url, DEFAULT_CONTENT_WIDTH, contentStateInitValues)
    );

    // The pane's rendered width in CSS pixels, reported back by
    // `ContentSlider` with `bind:clientWidth`. Deliberately a store of its own
    // rather than a field on the one above: it is written on every frame of the
    // 400ms tween, and every one of those writes would otherwise re-run the
    // `$contentState` sync block for a value that block does not read.
    const pixelWidth = writable(0);

    const larger = () => {
      update((values) => {
        if (values.width > 0) {
          contentState.onlyContent();
          return values;
        } else {
          // We need to make sure, that `noContent` is not `true`
          contentState.reset();
        }

        return { ...values, width: values.lastSetWidth };
      });
    };

    const smaller = () => {
      update((values) => {
        if (values.width < 1.0) {
          contentState.noContent();
          return values;
        } else {
          // We need to make sure, that `onlyContent` is not `true`
          contentState.reset();
        }

        return { ...values, width: values.lastSetWidth };
      });
    };

    /**
     * @param {Number} val
     */
    function setWidth(val) {
      update((values) => {
        return { ...values, width: val };
      });
    }

    const confirmWidth = () => {
      update((values) => {
        const w = values.width;

        if (w == 1.0) {
          contentState.onlyContent();
        } else if (w == 0.0) {
          contentState.noContent();
        } else {
          contentState.reset();
        }

        return {
          ...values,
          lastSetWidth: w > 0.0 && w < 1.0 ? w : values.lastSetWidth
        };
      });
    };

    return {
      subscribe,
      larger,
      smaller,
      setWidth,
      confirmWidth,
      update,
      pixelWidth
    };
  }

  const contentState = getContext('contentState');
  const sliderState = createContentSliderState($page.url, $contentState, contentState);

  $: {
    if ($contentState.onlyContent && $sliderState.width != 1.0) {
      sliderState.setWidth(1.0);
    } else if (
      ($contentState.noContent || !$contentState.hasContent) &&
      $sliderState.width != 0.0
    ) {
      sliderState.setWidth(0.0);
    } else if ($contentState.hasContent && !$contentState.noContent && $sliderState.width == 0.0) {
      sliderState.larger();
    }
  }

  setContext('contentSliderState', sliderState);
</script>

<slot />
