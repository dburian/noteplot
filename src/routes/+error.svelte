<script>
  import { page } from '$app/stores';
	import Prose from '$lib/Prose.svelte';
</script>

<div class="w-full h-screen grid content-center justify-center
justify-items-center">
<Prose>
  <h1>Ooops, something went wrong.</h1>
  <code>{$page.status}</code>: {$page.error.message}
</Prose>
<Prose>
<h2 class="mt-6"><a href="/">Go to index</a></h2>
</Prose>
</div>
