<script>
  import { getContext, setContext } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { writable } from 'svelte/store';
  import { base } from '$app/paths';
  import { page } from '$app/stores';

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

    const larger = () => {
      update((values) => {
        if (values.width > 0) {
          contentState.onlyContent();
          return values;
        } else {
          // We need to make sure, that `noContent` is not `true`
          contentState.reset()
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
          contentState.reset()
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
      update
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
      sliderState.larger()
    }
  }

  setContext('contentSliderState', sliderState);
  const sliderWidth = tweened($sliderState.width, {
    duration: 400,
    easing: cubicOut
  });

  $: if ($sliderState.width !== $sliderWidth) sliderWidth.set($sliderState.width);
</script>

<div
  class={`sm:fixed sm:top-0 sm:right-0 sm:border-l-front-light dark:sm:border-l-front-dark ${$sliderState.width > 0 && 'sm:border-l-2'}`}
  style={`width: ${$sliderWidth * 100}vw; max-width: calc(100vw - 4.5rem)`}
>
  <slot />
</div>
