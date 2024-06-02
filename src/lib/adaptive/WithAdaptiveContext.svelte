<script>
    import { setContext } from "svelte";
    import MediaQuery from "./MediaQuery.svelte";
    import { writable } from "svelte/store";

  export let mobileQuery = '(max-width:639px)';

  const adaptiveState = writable({
    mobile: false,
    desktop: false,
  })

  const onChange = (e) => {
    adaptiveState.set({
      mobile: e.detail,
      desktop: !e.detail,
    })
  }

  setContext("adaptive", adaptiveState)
</script>

<MediaQuery on:change={onChange} query={mobileQuery} />
<slot />

