<script>
    import { dev } from "$app/environment";
    import { base } from "$app/paths";
    import InfoBox from "$lib/components/InfoBox.svelte";

  export let slug, title, links, backlinks, noteRoot, matter, readingTime;

  export let displayNoteRoot = dev;
  export let displaySlug = dev;

  // Reactive and defaulted: `matter` is `{}` for a note with no frontmatter,
  // and was `null` in anything built before the frontmatter fix.
  let tags, otherMatter;
  $: ({ tags, ...otherMatter } = matter ?? {});

  // `readingTime.time` is a duration in milliseconds. Reading it back through
  // `new Date(...).getMinutes()` was a wall-clock read, and so wrong in any
  // timezone whose offset is not a whole number of hours (ISSUES.md B11).
  let readMins, readSecs;
  $: readMins = Math.floor(readingTime.time / 60000);
  $: readSecs = Math.round((readingTime.time % 60000) / 1000);
</script>

<InfoBox>
  <ul class="list-none p-0">
    {#if links.length > 0}
      <li><strong>references:</strong></li>
      <ul>
        {#each links as link}
          <li><a href={`${base}/${link.slug}`} data-slug={link.slug}>{link.title}</a></li>
        {/each}
      </ul>
    {/if}
    {#if backlinks.length > 0}
      <li><strong>is referenced by:</strong></li>
      <ul>
        {#each backlinks as link}
          <li><a href={`${base}/${link.slug}`} data-slug={link.slug}>{link.title}</a></li>
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
