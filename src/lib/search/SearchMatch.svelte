<script>
  import { base } from '$app/paths';
  import { createEventDispatcher } from 'svelte';

  import { rowClass } from '$lib/overlay/row_style.js';
  import { buildSnippet } from './snippet.js';

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
   */

  /** @type {import('./search_index.js').Match} */
  export let match;

  /** Whether ↑/↓ has this row highlighted. @type {boolean} */
  export let active = false;

  /** Show which fields matched. Driven by the metadata preference (settings overlay). @type {boolean} */
  export let showMeta = false;

  /** Characters of excerpt around the match. @type {number} */
  export let snippetLength = 220;

  const dispatch = createEventDispatcher();

  $: href = `${base}/${encodeURIComponent(match.note.slug)}`;

  /** minisearch reports `{term: [field, ...]}`. @type {[string, string[]][]} */
  $: matched = Object.entries(match.matchedFields ?? {});

  /**
   * The note's directory, from the `path` the preprocessor writes into
   * `search.json`. It is **not** derived from the slug: slugs are opaque and
   * nothing reverse-parses one (see the root `CLAUDE.md`). Empty at the root of
   * the collection, and empty against an index built before the field existed.
   */
  $: dir = (match.note.path ?? '').split('/').slice(0, -1).join('/');

  $: tags = match.note.matter?.tags ?? [];

  $: snippet = buildSnippet(
    match.note.content,
    matched.map(([term]) => term),
    { window: snippetLength }
  );

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
>
  <span class="flex items-baseline gap-3">
    <span class="min-w-0 truncate text-emphasis-light dark:text-emphasis-dark">
      {match.note.title}
    </span>
    {#if dir}
      <span class="ml-auto shrink-0 text-xs text-muted-light dark:text-muted-dark">{dir}</span>
    {/if}
  </span>

  {#if tags.length}
    <span class="mt-0.5 block truncate text-xs text-muted-light dark:text-muted-dark">
      {#each tags as tag}<span class="mr-2">#{tag}</span>{/each}
    </span>
  {/if}

  <!--
    The line breaks inside the loop below are load-bearing, and the `</strong\n >`
    especially so. Svelte collapses a run of whitespace in a text node to a
    single space, so putting `{#each}`, `{#if}` and `</strong>` on tidy separate
    lines renders "convexity" as "convex ity". Verify with
    `svelte.compiler.compile(src, {generate: 'ssr'})` if you reflow this.
  -->
  {#if snippet.parts.length}
    <span class="mt-1 block line-clamp-2 text-sm text-muted-light dark:text-muted-dark">
      {#if snippet.head}…{/if}{#each snippet.parts as part}{#if part.match}<strong
            class="font-semibold text-front-light dark:text-front-dark">{part.text}</strong
          >{:else}{part.text}{/if}{/each}{#if snippet.tail}…{/if}
    </span>
  {/if}

  {#if showMeta && matched.length}
    <span class="mt-1 block truncate text-xs italic text-muted-light dark:text-muted-dark">
      {#each matched as [term, fields]}<span class="mr-2">{term}:{fields.join(',')}</span>{/each}
    </span>
  {/if}
</a>
