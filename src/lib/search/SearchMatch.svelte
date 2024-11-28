<script>
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';

  export let tabIndex;
  export let maxContentLength = 150;
  /**
   * @type {{note: {title: string, slug: string, content: string, tags: string[]}, matchedFields: string[]}}
   */
  export let match;

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
  on:click={() => goto(`${base}/${match.note.slug}`)}
  role="link"
  on:keydown={() => {}}
  tabindex={tabIndex}
>
  <h3 class={`text-xl mb-0 mr-3 ${hover && 'underline'}`}>{match.note.title}</h3>
  <div class={`mb-3 text-white italic text-sm dark:invert-white`}>
    {#each Object.getOwnPropertyNames(match.matchedFields) as term}
      <span class={`mr-2`}>{term}:{match.matchedFields[term]}</span>
    {/each}
  </div>

  <p>{content}</p>
</div>
