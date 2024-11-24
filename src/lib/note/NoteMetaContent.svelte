<script>
    import { dev } from "$app/environment";
    import InfoBox from "$lib/components/InfoBox.svelte";

  export let slug, title, links, backlinks, noteRoot, matter, readingTime;

  export let displayNoteRoot = dev;
  export let displaySlug = dev;

  const { tags, ...otherMatter } = matter;
  const readDate = new Date(readingTime.time)
  const readMins = readDate.getMinutes()
  const readSecs = readDate.getSeconds()
</script>

<InfoBox>
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
    {#if tags && tags.length > 0}
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
    <li><strong>read time:</strong>
      {#if readMins > 0}
        {readMins}<small>mins</small>
      {/if}
      {readSecs}<small>s</small></li>
    <li><strong>words:</strong> {readingTime.words}</li>
  </ul>
</InfoBox>
