<script>
  import { onMount } from 'svelte';
  import { useAppState, SELECTION, NOTES_INDEX } from '$lib/state/keys.js';

  /**
   * Hovering a link in the prose highlights the matching node in the
   * visualization, and vice versa. Both ends meet on `selection.hoveredNote`.
   *
   * **Scoped to its own container.** This used to query
   * `document.querySelectorAll('#note-content a[data-slug]')` — a document-wide
   * search for a hard-coded id, which was correct only while exactly one note
   * was ever mounted. With N columns that id is duplicated and every instance
   * would wire up (and later un-wire) every *other* column's links. The
   * container is bound and queried directly instead, so an instance only ever
   * sees its own note.
   */
  const selection = /** @type {import('$lib/state/selection.js').SelectionStore} */ (
    useAppState(SELECTION)
  );
  const notesIndex = /** @type {import('$lib/state/notes_index.js').NotesIndex} */ (
    useAppState(NOTES_INDEX)
  );

  /** @type {HTMLElement} */
  let container;

  /**
   * @param {HTMLAnchorElement} linkElement
   */
  function registerEvents(linkElement) {
    linkElement.addEventListener('mouseenter', mouseenter);
    linkElement.addEventListener('mouseleave', mouseleave);
  }

  /**
   * @this {HTMLAnchorElement}
   */
  function mouseenter() {
    // `dataset` rather than `attributes[...]`: the query selected on
    // `[data-slug]`, so it is there, but only `dataset` says so in a type the
    // checker understands.
    const slug = this.dataset.slug;
    if (!slug) return;
    selection.hover({ slug, title: notesIndex.titleOf(slug) });
  }

  function mouseleave() {
    selection.hover(null);
  }

  /**
   * @param {HTMLAnchorElement} linkElement
   */
  function unregisterEvents(linkElement) {
    linkElement.removeEventListener('mouseenter', mouseenter);
    linkElement.removeEventListener('mouseleave', mouseleave);
  }

  /** @type {Map<string,Array<HTMLAnchorElement>>} */
  let contentNoteLinks;
  onMount(() => {
    contentNoteLinks = new Map();

    /** @type {NodeListOf<HTMLAnchorElement>} */
    const noteLinks = container.querySelectorAll('a[data-slug]');
    for (const link of noteLinks) {
      const linkSlug = link.dataset.slug;
      if (!linkSlug) continue;
      const forSlug = contentNoteLinks.get(linkSlug) ?? [];
      forSlug.push(link);
      contentNoteLinks.set(linkSlug, forSlug);
    }

    for (const link of noteLinks) {
      registerEvents(link);
    }

    // Returned, so Svelte actually runs it on destroy (ISSUES.md B13).
    return () => {
      for (const links of contentNoteLinks.values()) {
        for (const link of links) unregisterEvents(link);
      }
    };
  });

  /** @type {string | null} */
  let lastHoveredSlug = null;

  /**
   * @param {{slug: string} | null} hoveredNote
   */
  function reflectHoveredNote(hoveredNote) {
    if (!hoveredNote) {
      if (!lastHoveredSlug) return;

      for (const link of contentNoteLinks.get(lastHoveredSlug) ?? []) {
        link.classList.remove('hovered-link');
      }
      lastHoveredSlug = null;
      return;
    }

    const links = contentNoteLinks.get(hoveredNote.slug);
    if (!links) return;

    for (const link of links) {
      link.classList.add('hovered-link');
    }
    lastHoveredSlug = hoveredNote.slug;
  }

  $: if (contentNoteLinks && $selection.hoveredNote?.slug != lastHoveredSlug)
    reflectHoveredNote($selection.hoveredNote);
</script>

<div bind:this={container} class="note-content">
  <slot />
</div>

<style>
  /* A class, not the `#note-content` id this used to carry: the element exists
     once per open column. */
  @media (prefers-color-scheme: dark) {
    .note-content :global(.hovered-link) {
      color: #fff;
    }
  }

  @media (prefers-color-scheme: light) {
    .note-content :global(.hovered-link) {
      color: #000;
    }
  }
</style>
