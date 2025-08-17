<script>
    import { afterNavigate, goto } from '$app/navigation';
  import { base } from '$app/paths';
    import { page } from '$app/state';
    import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  function extractContentSwitcherStateFromUrl(url) {
    const searchParams = typeof window !== 'undefined' ? url.searchParams : new Map();

    const fullContent = searchParams.get('fullContent') == ''

    const state = {
      hasContent: url.pathname !== `${base}/`,
      fullContent: fullContent,
      noContent: !fullContent,
    };

    return state;
  }

  function createContentSwitcherState(url) {
    const { subscribe, update } = writable(createContentSwitcherState(url));

    const switchToGraph = () => {
      update((values) => {
        return { ...values, fullContent: false, noContent: true };
      });
    };

    const switchToContent = () => {
      update((values) => {
        return { ...values, fullContent: true, noContent: false };
      });
    };

    const reset = () => {
      update((values) => ({...values, full
    }

    return {
      subscribe,
      update,
      switchToGraph,
      switchToContent
    };
  }

  const switcherState = createContentSwitcherState($page.url)

  afterNavigate((ev) => {
    if (ev.from?.url !== ev.to?.url && ev.to !== null) {
      switcherState.update((values) => {
        const newValues = extractContentSwitcherStateFromUrl(ev.to.url);

        if (!values.hasContent && newValues.hasContent){
          newValues.fullContent = true
          newValues.noContent = false

        }

        return { ...newValues };
      });
    }
  });

  $: {
    if (typeof window !== 'undefined') {
      if ($switcherState.fullContent && !$switcherState.fullContent) {
        goto('?fullContent', { replaceState: true });
      } else if ($switcherState.width == 0.0 && !$switcherState.noContent) {
        goto('?noContent', { replaceState: true });
      } else if (
        ($switcherState.width > 0.0 && $switcherState.noContent) ||
        ($switcherState.width < 1.0 && $switcherState.fullContent)
      ) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('noContent');
        nextUrl.searchParams.delete('fullContent');
        goto(nextUrl, { replaceState: true });
      }
    }
  }

  setContext("contentSwitcherState", switcherState)
</script>
