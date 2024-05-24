<script>
  import { onMount } from "svelte";
  import { extractState, urlState } from "./stores/url";


  const onNavigate = (event) => {
    urlState.update(() => extractState(new URL(event.destination.url)))
  }

  onMount(() => {
    urlState.update(() => extractState(window.location))

    window.navigation.addEventListener("navigate", onNavigate)

    return () => {
      window.navigation.removeEventListener("navigate", onNavigate)
    };
  })

  $: console.log($urlState)
</script>

<slot />
