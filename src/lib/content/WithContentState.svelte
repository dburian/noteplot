<script>
  import { afterNavigate, goto, replaceState } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  function extractContentSwitcherStateFromUrl(url) {
    const searchParams = typeof window !== 'undefined' ? url.searchParams : new Map();

    const state = {
      hasContent: url.pathname !== `${base}/`,
      onlyContent: searchParams.get('onlyContent') == '',
      noContent: searchParams.get('noContent') == ''
    };

    return state;
  }

  function createContentSwitcherState(url) {
    const { subscribe, update: rawUpdate } = writable(extractContentSwitcherStateFromUrl(url));

    const update = (updateFn) => {
      rawUpdate((oldValues) => {
        const newValues = updateFn(oldValues);
        const newUrl = new URL(page.url);

        if (newValues.onlyContent) {
          newUrl.searchParams.set('onlyContent', '');
          newUrl.searchParams.delete('noContent', '');
        } else if (newValues.noContent) {
          newUrl.searchParams.set('noContent', '');
          newUrl.searchParams.delete('onlyContent', '');
        }

        if (newUrl != page.url) {
          replaceState(newUrl, {});
        }

        return newValues;
      });
    };

    const onlyContent = () => {
      update((oldValues) => ({ ...oldValues, onlyContent: true, noContent: false }));
    };

    const noContent = () => {
      update((oldValues) => ({ ...oldValues, onlyContent: false, noContent: true }));
    };

    const reset = () => {
      update((oldValues) => ({ ...oldValues, onlyContent: false, noContent: false }));
    };

    return {
      subscribe,
      update,
      onlyContent,
      noContent,
      rawUpdate,
      reset
    };
  }

  const contentState = createContentSwitcherState(page.url);

  // We need to sync the url state to the store.
  afterNavigate((ev) => {
    if (ev.from?.url !== ev.to?.url && ev.to !== null) {
      contentState.rawUpdate((values) => extractContentSwitcherStateFromUrl(ev.to.url));
    }
  });

  setContext('contentState', contentState);
</script>

<slot />
