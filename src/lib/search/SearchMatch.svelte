<script>
    import { getContext } from "svelte";
    import SearchMatchSpans from "./SearchMatchSpans.svelte";

  const giState = getContext('graphInterfaceState')

  export let match;
  let hover = false;
</script>

<div
  class={`p-4 ${hover ? "border-black ": "border-white"} max-w-prose border-2 cursor-pointer`}
  on:mouseenter={() => hover = true}
  on:mouseleave={() => hover = false}
  on:click={() => giState.update({viewedNote: match.note, search: null})}
  role="link"
>
  <h3 class="text-2xl mb-4">
    {#if match.title.length > 0}
      <SearchMatchSpans spans={match.title} />
    {:else}
      {match.note.title}
    {/if}
  </h3>

  <p>
    {#if match.content.length > 0}
      <SearchMatchSpans spans={match.content} />
    {:else}
      {#each match.note.content.split('\n').filter(s => s) as paragraph}
        <span class="mr-4">{paragraph}</span>
      {/each}
    {/if}
  </p>
</div>
