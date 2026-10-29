<script>
  import { base } from '$app/paths';
  import { createEventDispatcher } from 'svelte';

  import { rowClass } from '$lib/overlay/row_style.js';
  import Marked from './Marked.svelte';
  import { highlight } from './snippet.js';

  /**
   * One result row, in the search or the filter overlay.
   *
   * It is a **real `<a href>`**, not the `<div role="link">` with an `on:click`
   * and a no-op `on:keydown` it used to be. Middle-click, Ctrl/Cmd-click,
   * keyboard activation, "copy link address" and SvelteKit's link preloading
   * all work for free once the element is the right one; none of them worked
   * before.
   *
   * The click is still intercepted, because opening a note here means writing a
   * tile, not navigating (`WithAppState` derives the path from the focused
   * tile). The exception is a modified click — Ctrl/Cmd/Shift is a request for
   * a new tab or window, and that is the browser's to honour, so the default is
   * left alone.
   *
   * Three lines rather than one, now that the overlay is a whole pane: title
   * and directory, tags, and a **match-centred** excerpt with the matched terms
   * bolded. The old row showed `content.slice(0, 160)` — the opening of the
   * note — which said that a note matched but never where.
   *
   * The excerpt is built in the search worker (the only place note bodies
   * live) and passed in; `undefined` while it is on its way, which renders
   * the row without that line.
   */

  /** @type {import('./search_client.js').Match} */
  export let match;

  /** @type {import('./snippet.js').Snippet | undefined} */
  export let snippet = undefined;

  /** Whether ↑/↓ has this row highlighted. @type {boolean} */
  export let active = false;

  /** Show which fields matched. Driven by the metadata preference (settings overlay). @type {boolean} */
  export let showMeta = false;

  const dispatch = createEventDispatcher();

  $: href = `${base}/${encodeURIComponent(match.note.slug)}`;

  /** minisearch reports `{term: [field, ...]}`. @type {[string, string[]][]} */
  $: matched = Object.entries(match.matchedFields ?? {});

  /**
   * The note's directory, from the `path` the preprocessor writes into
   * `index.json`. It is **not** derived from the slug: slugs are opaque and
   * nothing reverse-parses one (see the root `CLAUDE.md`). Empty at the root of
   * the collection.
   */
  $: dir = (match.note.path ?? '').split('/').slice(0, -1).join('/');

  $: tags = match.note.matter?.tags ?? [];

  /**
   * The matched terms per field, for bolding in the title and tags as well as
   * the snippet. Only the terms that hit *that* field: a body term that
   * happens to occur in the title as well did not make the title match.
   *
   * `matched` is a **parameter**, not read from the closure, and that is
   * load-bearing: Svelte sees a `$:` statement's dependencies only in the
   * statement itself. Closed over, `$: tagTerms = termsIn('tag')` named no
   * reactive variable, compiled to a one-off run at construction — before
   * `matched` existed — and crashed every row.
   *
   * @param {[string, string[]][]} entries
   * @param {string} field
   */
  const termsIn = (entries, field) =>
    entries.filter(([, fields]) => fields.includes(field)).map(([t]) => t);
  $: titleParts = highlight(match.note.title, termsIn(matched, 'title'));
  $: tagTerms = termsIn(matched, 'tag');

  /** @type {HTMLAnchorElement | undefined} */
  let anchor;

  // Keep the ↑/↓ cursor inside the scrolled list. `nearest` is deliberate: it
  // scrolls only when the row is actually out of view, so walking down the list
  // does not jump the panel around.
  $: if (active && anchor) anchor.scrollIntoView({ block: 'nearest' });

  /** @param {MouseEvent} ev */
  function onClick(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    dispatch('open', { where: ev.altKey ? 'new' : 'focused' });
  }

  /**
   * Middle-click opens a new column, matching the history chips and prose
   * links. `preventDefault` suppresses the autoscroll cursor.
   *
   * @param {MouseEvent} ev
   */
  function onAuxClick(ev) {
    if (ev.button !== 1) return;
    ev.preventDefault();
    dispatch('open', { where: 'new' });
  }
</script>

<a
  bind:this={anchor}
  {href}
  class="{rowClass(active)} px-4 py-3"
  on:click={onClick}
  on:auxclick={onAuxClick}
  on:mouseenter
  on:mouseleave
>
  <span class="flex items-baseline gap-3">
    <span class="min-w-0 truncate text-emphasis-light dark:text-emphasis-dark">
      <Marked parts={titleParts} strongClass="font-semibold" />
    </span>
    {#if dir}
      <span class="ml-auto shrink-0 text-xs text-muted-light dark:text-muted-dark">{dir}</span>
    {/if}
  </span>

  {#if tags.length}
    <span class="mt-0.5 block truncate text-xs text-muted-light dark:text-muted-dark">
      {#each tags as tag}<span class="mr-2">#<Marked parts={highlight(tag, tagTerms)} /></span
        >{/each}
    </span>
  {/if}

  <!-- No whitespace between the ellipses and `Marked`: it would render as a space. -->
  {#if snippet?.parts.length}
    <span class="mt-1 block line-clamp-2 text-sm text-muted-light dark:text-muted-dark">
      {#if snippet.head}…{/if}<Marked parts={snippet.parts} />{#if snippet.tail}…{/if}
    </span>
  {/if}

  {#if showMeta && matched.length}
    <span class="mt-1 block truncate text-xs italic text-muted-light dark:text-muted-dark">
      {#each matched as [term, fields]}<span class="mr-2">{term}:{fields.join(',')}</span>{/each}
    </span>
  {/if}
</a>
