<script>
  import { createEventDispatcher, onMount } from 'svelte';

  /** The media query to watch, e.g. `(max-width:639px)`. @type {string} */
  export let query;
  /** @type {boolean | null} */
  export let matches = null;

  /** @type {import('svelte').EventDispatcher<{change: boolean}>} */
  const dispatch = createEventDispatcher();

  /** @param {MediaQueryList | MediaQueryListEvent} mql */
  function onChange(mql) {
    matches = mql.matches;
    dispatch('change', matches);
  }

  onMount(() => {
    const mql = window.matchMedia(query);
    onChange(mql);

    mql.addEventListener('change', onChange);

    return () => {
      mql.removeEventListener('change', onChange);
    };
  });
</script>
