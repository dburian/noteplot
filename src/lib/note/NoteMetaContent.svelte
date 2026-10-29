<script>
  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import InfoBox from '$lib/components/InfoBox.svelte';

  // No `title`: this block is *about* the note, and the note's own title is
  // rendered by its content, not repeated here. `NoteContent` builds these
  // props explicitly, so dropping it here drops it there too.
  export let slug, links, backlinks, noteRoot, matter, readingTime, created, accessed;

  export let displayNoteRoot = dev;
  export let displaySlug = dev;

  // Reactive and defaulted: `matter` is `{}` for a note with no frontmatter,
  // and was `null` in anything built before the frontmatter fix.
  let tags, otherMatter, matterKeys;
  $: ({ tags, ...otherMatter } = matter ?? {});
  // Frontmatter `created` / `accessed` are left out: the preprocessor does not
  // read them, and the real dates are shown below.
  $: matterKeys = Object.keys(otherMatter).filter((key) => key != 'created' && key != 'accessed');

  // `readingTime.time` is a duration in milliseconds. Reading it back through
  // `new Date(...).getMinutes()` was a wall-clock read, and so wrong in any
  // timezone whose offset is not a whole number of hours (ISSUES.md B11).
  let readMins, readSecs;
  $: readMins = Math.floor(readingTime.time / 60000);
  $: readSecs = Math.round((readingTime.time % 60000) / 1000);

  /**
   * The local calendar day of a ms timestamp, as `YYYY-MM-DD`.
   *
   * @param {number} ms
   */
  function day(ms) {
    const date = new Date(ms);
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
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
    {#if created !== undefined}
      <li><strong>created:</strong> {day(created)}</li>
      <li><strong>last accessed:</strong> {day(accessed)}</li>
    {/if}
    {#each matterKeys as key}
      <li><strong>{key}:</strong> {matter[key]}</li>
    {/each}
    {#if displayNoteRoot}
      <li><strong>note root:</strong> <code>{noteRoot}</code></li>
    {/if}
    {#if displaySlug}
      <li><strong>slug:</strong> <code>{slug}</code></li>
    {/if}
    <li>
      <strong>read time:</strong>
      {#if readMins > 0}
        {readMins}<small>mins</small>
      {/if}
      {readSecs}<small>s</small>
    </li>
    <li><strong>words:</strong> {readingTime.words}</li>
  </ul>
</InfoBox>
