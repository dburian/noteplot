<script>
  import { setContext } from "svelte";
    import { writable } from "svelte/store";


  function createFilterState() {
    const {subscribe, update } = writable({})

    const filter = (filterSpec) => {
    }

    return {
      subscribe,
    }
  }

  const filterContext = createFilterState()

  setContext('filterState', filterContext)

</script>


<slot />

