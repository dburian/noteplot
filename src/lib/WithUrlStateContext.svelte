<script>
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { setContext } from 'svelte';
  import { derived } from 'svelte/store';

  /**
   * @param {URL} url
   */
  function extractUrlState(url) {
    return {
      fullContent: url.searchParams.get('fullContent') == '',
      noContent: url.searchParams.get('noContent') == '',
      searchString: url.searchParams.get('q') || null,
      hasContent: url.pathname !== (base === '' ? '/' : base),
      lastUrl: url
    };
  }

  /**
   * @typedef {{fullContent: boolean, noContent: boolean, searchString: string | null, hasContent: boolean, lastUrl: URL}} UrlState
   */

  /**
   * @type {import('svelte/store').Readable<UrlState>}
   */
  const urlState = derived(page, ({ url }) => extractUrlState(url));
  setContext('urlState', urlState);
</script>

<slot />
