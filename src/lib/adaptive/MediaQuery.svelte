<script>
  import { createEventDispatcher, onMount } from "svelte";

  export let query;
  export let matches = null;

  const dispatch = createEventDispatcher()

  function onChange(mql) {
    matches = mql.matches
    dispatch("change", matches);
  }

  onMount(() => {
    const mql = window.matchMedia(query);
    onChange(mql)

    mql.addEventListener("change", onChange);

    return () => {
      mql.removeEventListener("change", onChange)
    }
  })
</script>


