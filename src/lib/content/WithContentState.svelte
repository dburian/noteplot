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
      // `/notes/<slug>` is the note-only route. It *seeds* the state rather
      // than owning it: a later `reset()` clears the store for the session,
      // but the pathname says note-only again on the next navigation or
      // reload. Expressing the route through this store is what keeps it from
      // needing a second mechanism of its own -- the `withGraph` /
      // `graphFullScreen` flags that four `load` functions used to return and
      // nothing ever read (ISSUES.md B7).
      onlyContent:
        url.pathname.startsWith(`${base}/notes/`) || searchParams.get('onlyContent') == '',
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
        } else {
          // The `reset()` path. Without this branch neither param was ever
          // removed, so resetting left a stale `?onlyContent` in the URL and
          // the state came back on the next reload.
          newUrl.searchParams.delete('onlyContent');
          newUrl.searchParams.delete('noContent');
        }

        // `URL` objects compare by reference, so this used to be always true
        // and `replaceState` fired on every update (ISSUES.md B8).
        if (newUrl.href !== page.url.href) {
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
