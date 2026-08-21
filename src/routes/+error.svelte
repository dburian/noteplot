<script>
  import { page } from '$app/stores';
  import { indexPath } from '$lib/state/url_state.js';
  import Prose from '$lib/Prose.svelte';
</script>

<!--
  This page renders outside the `(app)` layout, so the content pane -- which
  owns `document.title` everywhere else -- is not mounted. Hence its own.
-->
<svelte:head>
  <title>Noteplot | {$page.status}</title>
</svelte:head>

<div
  class="w-full h-screen grid content-center justify-center
justify-items-center"
>
  <Prose>
    <h1>Ooops, something went wrong.</h1>
    <code>{$page.status}</code>: {$page.error?.message ?? 'Unknown error'}
  </Prose>
  <Prose>
    <!-- `indexPath()` and not a bare "/": that is not `base`-prefixed, so
         under a sub-path deploy it leaves the site entirely. -->
    <h2 class="mt-6"><a href={indexPath()}>Go to index</a></h2>
  </Prose>
</div>
