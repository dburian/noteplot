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
  <h3 class="text-2xl mb-4"> {match.note.title} </h3>
  <h6>
    {#each match.matchedFields as field}
      <span>{field}</span>
    {/each}
  </h6>

  <p>
    {#each match.note.content.substring(0, 100).split('\n').filter(s => s) as paragraph}
      <span class="mr-4">{paragraph}</span>
    {/each}
  </p>
</div>
