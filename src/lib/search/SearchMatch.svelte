<script>
  import { getContext } from 'svelte';

  export let tabIndex
  export let maxContentLength = 150;
  /**
   * @type {{note: {title: string, content: string, tags: string[]}, matchedFields: string[]}}
   */
  export let match;

  const giState = getContext('graphInterfaceState');

  const content =
    match.note.content
      .substring(0, maxContentLength)
      .split('\n')
      .filter((s) => s)
      .join('... ') + '...';
  let hover = false;
</script>

<div
  class={`p-2 max-w-prose cursor-pointer mb-9`}
  on:mouseenter={() => (hover = true)}
  on:mouseleave={() => (hover = false)}
  on:click={() => giState.update({ viewedNote: match.note, search: null })}
  role="link"
  on:keydown={() => {}}
  tabindex={tabIndex}
>
  <h3 class={`text-xl mb-0 mr-3 ${hover && 'underline' }`}>{match.note.title}</h3>
  <div class={`mb-3 text-white italic text-sm dark:invert-white`}>
    {#each match.matchedFields as field}
      <span class={`mr-2`}>{field}</span>
    {/each}
  </div>

  <p>{content}</p>
</div>
