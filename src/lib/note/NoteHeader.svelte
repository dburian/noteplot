<script>
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { useAppState, FILTER, LAYOUT, NOTES_INDEX } from '$lib/state/keys.js';

  /**
   * Everything above a note's body: backlinks and references side by side,
   * the tags, the title, and a dimmed line of dates and reading time, plus one
   * of any other frontmatter.
   *
   * Always shown -- it is part of the note, not a debugging readout, so it is
   * not behind `$prefs.showMeta` the way the `InfoBox` it replaced was.
   *
   * **The title is rendered here, not by the note's HTML.** The preprocessor
   * removes the heading the title came from when it opens the note
   * (`removeLeadingHeading` in `preprocessor/parse/plugins.js`), because the
   * tags go above it and the dates below. A note with no heading gets its
   * filename title here too.
   *
   * @type {import('$lib/notes_route.js').Note}
   */
  export let note;

  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));
  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );

  // Frontmatter that is shown elsewhere, or not at all: tags have their own
  // row, the title is the heading, and the preprocessor ignores frontmatter
  // dates in favour of git/filesystem ones (root CLAUDE.md, "Note dates").
  const SHOWN_ELSEWHERE = new Set(['tags', 'title', 'created', 'accessed']);

  $: matter = note.matter ?? {};
  $: tags = Array.isArray(matter.tags) ? matter.tags.map(String) : [];
  $: otherMatter = Object.entries(matter).filter(([key]) => !SHOWN_ELSEWHERE.has(key));

  // At least a minute: "0 min read" reads as an empty note.
  $: readMins = Math.max(1, Math.round(note.readingTime.minutes));

  /**
   * The browser's own date format -- `10. 9. 2022` in Czech. The prerendered
   * page carries the build machine's format until it hydrates.
   *
   * @param {number} ms
   */
  function day(ms) {
    return new Date(ms).toLocaleDateString();
  }

  /** @param {unknown} value */
  function show(value) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  /**
   * The search-language filter for one tag. Quoted when it has whitespace, or
   * `tag:two words` would be a `tag:two` and a bare `words`.
   *
   * @param {string} tag
   */
  function tagFilter(tag) {
    return /\s/.test(tag) ? `tag:"${tag}"` : `tag:${tag}`;
  }

  /**
   * A real URL, so middle-click and "copy link" carry the filter. Built from
   * the live URL in the browser so the layout params survive; the prerender
   * may not read `searchParams`, so it gets the path alone.
   *
   * @param {URL} url
   * @param {string} tag
   */
  function tagHref(url, tag) {
    if (!browser) return `${url.pathname}?filter=${encodeURIComponent(tagFilter(tag))}`;
    const next = new URL(url);
    next.searchParams.set('filter', tagFilter(tag));
    return next.pathname + next.search;
  }

  /**
   * Applies the filter in place instead of navigating; the URL follows from
   * `filter.text`. A filter only shows in the visualization, so a content-only
   * layout is opened to the split. Ctrl/Cmd/Shift is a request for a new tab
   * or window, which is the browser's to honour.
   *
   * @param {MouseEvent} ev
   * @param {string} tag
   */
  function onTagClick(ev, tag) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    filter.apply(tagFilter(tag));
    if ($layout.mode === 'content') layout.setMode('split');
  }
</script>

{#if note.backlinks.length > 0 || note.links.length > 0}
  <div class="prose-high-level-tag">
    <div class="not-prose grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-6">
      <ul class="min-w-0 list-none p-0 m-0">
        {#each note.backlinks as link}
          <li class="truncate">
            <span aria-hidden="true" class="text-muted-light dark:text-muted-dark">→</span>
            <a class="note-meta-link" href={`${base}/${link.slug}`} data-slug={link.slug}
              >{link.title}</a
            >
          </li>
        {/each}
      </ul>
      <ul class="min-w-0 list-none p-0 m-0 text-right">
        {#each note.links as link}
          <li class="truncate">
            <a class="note-meta-link" href={`${base}/${link.slug}`} data-slug={link.slug}
              >{link.title}</a
            >
            <span aria-hidden="true" class="text-muted-light dark:text-muted-dark">→</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<div class="prose-high-level-tag">
  {#if tags.length > 0}
    <div class="not-prose flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {#each tags as tag}
        {@const color = notesIndex.tagColors.get(tag)}
        <a
          class="note-meta-link"
          href={tagHref($page.url, tag)}
          title={`Filter the visualization to ${tagFilter(tag)}`}
          on:click={(ev) => onTagClick(ev, tag)}
        >
          <span
            aria-hidden="true"
            class="tag-square"
            style={color ? `--tag-light:${color.light};--tag-dark:${color.dark}` : ''}>■</span
          >
          {tag}
        </a>
      {/each}
    </div>
  {/if}

  <h1 class="mt-2 mb-1">{note.title}</h1>

  <p class="not-prose text-sm text-muted-light dark:text-muted-dark">
    {#if note.created !== undefined && note.accessed !== undefined}
      Last accessed: {day(note.accessed)} · Created: {day(note.created)} ·
    {/if}
    {readMins} min read
  </p>
  {#if otherMatter.length > 0}
    <p class="not-prose text-sm text-muted-light dark:text-muted-dark">
      {otherMatter.map(([key, value]) => `${key}: ${show(value)}`).join(' · ')}
    </p>
  {/if}
</div>

<style>
  .note-meta-link {
    text-decoration: none;
  }
  .note-meta-link:hover {
    text-decoration: underline;
  }
  /* Inline custom properties, because the colour is data: Tailwind cannot see a
     class name built at runtime, and `dark:` needs both variants up front. */
  .tag-square {
    color: var(--tag-light, currentColor);
  }
  @media (prefers-color-scheme: dark) {
    .tag-square {
      color: var(--tag-dark, currentColor);
    }
  }
</style>
