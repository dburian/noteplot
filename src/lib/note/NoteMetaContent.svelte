<script>
  export let slug, title, links, backlinks, noteRoot, matter;

  export let displayNoteRoot = false;
  export let displaySlug = false;

  const { tags, ...otherMatter } = matter;
</script>

<section class="border-l-2 border-l-muted-light dark:border-l-muted-dark pl-4 py-1 text-sm mb-10">
  <ul class="list-none p-0">
    {#if links.length > 0}
      <li><strong>references:</strong></li>
      <ul>
        {#each links as link}
          <li><a href={`./${link.slug}`} data-slug={link.slug}>{link.title}</a></li>
        {/each}
      </ul>
    {/if}
    {#if backlinks.length > 0}
      <li><strong>is referenced by:</strong></li>
      <ul>
        {#each backlinks as link}
          <li><a href={`./${link.slug}`} data-slug={link.slug}>{link.title}</a></li>
        {/each}
      </ul>
    {/if}
    {#if tags.length > 0}
      <li><strong>tags:</strong> {tags.join(', ')}</li>
    {/if}
    {#each Object.keys(otherMatter) as key}
      <li><strong>{key}:</strong> {matter[key]}</li>
    {/each}
    {#if displayNoteRoot}
      <li><strong>note root:</strong> <code>{noteRoot}</code></li>
    {/if}
    {#if displaySlug}
    <li><strong>slug:</strong> <code>{slug}</code></li>
    {/if}
  </ul>
</section>
