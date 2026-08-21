<script>
  import { base } from '$app/paths';
  import { createEventDispatcher } from 'svelte';

  /**
   * One result row, in the search or the filter overlay.
   *
   * It is a **real `<a href>`** now, not the `<div role="link">` with an
   * `on:click` and a no-op `on:keydown` it used to be. Middle-click,
   * Ctrl/Cmd-click, keyboard activation, "copy link address" and SvelteKit's
   * link preloading all work for free once the element is the right one; none
   * of them worked before.
   *
   * The click is still intercepted, because opening a note here means writing a
   * tile, not navigating (`WithAppState` derives the path from the focused
   * tile). The exception is a modified click — Ctrl/Cmd/Shift is a request for
   * a new tab or window, and that is the browser's to honour, so the default is
   * left alone.
   *
   * It also lost the full-page card shape: `text-xl` titles with `mb-9` between
   * them fitted two results into the overlay's `max-h-[70vh]` panel.
   */

  /** @type {import('./search_index.js').Match} */
  export let match;

  /** Whether ↑/↓ has this row highlighted. @type {boolean} */
  export let active = false;

  /** Show which fields matched. Driven by the toolbar's Metadata toggle. @type {boolean} */
  export let showMeta = false;

  /** @type {number} */
  export let maxContentLength = 160;

  const dispatch = createEventDispatcher();

  $: href = `${base}/${encodeURIComponent(match.note.slug)}`;

  // The search index stores the note as one plaintext blob; its newlines are
  // paragraph breaks, which would each become a line of their own in a row that
  // is one line tall.
  $: excerpt =
    match.note.content.slice(0, maxContentLength).split('\n').filter(Boolean).join(' … ').trim() +
    ' …';

  /** minisearch reports `{term: [field, ...]}`. @type {[string, string[]][]} */
  $: matched = Object.entries(match.matchedFields ?? {});

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
  class="block px-3 py-2 border-l-2 no-underline
         {active
    ? 'border-l-emphasis-light dark:border-l-emphasis-dark bg-muted-light/20 dark:bg-muted-dark/20'
    : 'border-l-transparent hover:bg-muted-light/10 dark:hover:bg-muted-dark/10'}"
  on:click={onClick}
  on:auxclick={onAuxClick}
  on:mouseenter
>
  <span class="flex items-baseline gap-2">
    <span class="min-w-0 truncate text-emphasis-light dark:text-emphasis-dark">
      {match.note.title}
    </span>
    {#if showMeta}
      <span class="shrink-0 text-xs italic text-muted-light dark:text-muted-dark">
        {#each matched as [term, fields]}
          <span class="ml-2">{term}:{fields.join(',')}</span>
        {/each}
      </span>
    {/if}
  </span>
  <span class="block truncate text-sm text-muted-light dark:text-muted-dark">{excerpt}</span>
</a>
