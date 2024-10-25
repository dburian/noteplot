<script>
  import { createGraphInterfaceState } from '$lib/stores/graphInterfaceState.js';
  import { getContext, setContext } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { writable } from 'svelte/store';
  import { base } from '$app/paths';
  import { page } from '$app/stores';

  /**
   * @param {URL} url
   * @param {Number} defaultWidth
   */
  function extractContentSliderStateFromUrl(url, defaultWidth) {
    const state = {
      fullContent: url.searchParams.get('fullContent') == '',
      noContent: url.searchParams.get('noContent') == '',
      searchString: url.searchParams.get('q') || null,
      hasContent: url.pathname !== (base === '' ? '/' : base),
      lastUrl: url,
      width: defaultWidth,
      lastSetWidth: defaultWidth
    };

    if (state.fullContent) state.width = 1.0;
    else if (state.noContent || !state.hasContent) state.width = 0.0;
    return state;
  }

  /**
   * @param {URL} url
   */
  function createContentSliderState(url) {
    const { subscribe, update } = writable(extractContentSliderStateFromUrl(url, 0.3));

    const larger = () => {
      update((values) => {
        return {
          ...values,
          width: values.width > 0 ? 1.0 : values.lastSetWidth
        };
      });
    };

    const smaller = () => {
      update((values) => {
        return {
          ...values,
          width: values.width < 1.0 ? 0.0 : values.lastSetWidth
        };
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

  const sliderState = createContentSliderState($page.url);

  afterNavigate((ev) => {
    if (ev.from?.url !== ev.to?.url && ev.to !== null) {
      sliderState.update((values) => {
        const newValues = extractContentSliderStateFromUrl(ev.to.url, values.lastSetWidth);

        return { ...newValues };
      });
    }
  });

  $: {
    if (typeof window !== 'undefined') {
      if ($sliderState.width == 1.0 && !$sliderState.fullContent) {
        goto('?fullContent', { replaceState: true });
      } else if ($sliderState.width == 0.0 && !$sliderState.noContent) {
        goto('?noContent', { replaceState: true });
      } else if (
        ($sliderState.width > 0.0 && $sliderState.noContent) ||
        ($sliderState.width < 1.0 && $sliderState.fullContent)
      ) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('noContent');
        nextUrl.searchParams.delete('fullContent');
        goto(nextUrl, { replaceState: true });
      }
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
