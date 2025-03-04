<script>
  import { getContext, onMount } from 'svelte';
  const graphState = getContext('graphState');

  /**
   * @param {HTMLLinkElement} linkElement
   */
  function registerEvents(linkElement) {
    linkElement.addEventListener('mouseenter', mouseenter);
    linkElement.addEventListener('mouseleave', mouseleave);
  }

  /**
   * @this {HTMLLinkElement}
   */
  function mouseenter() {
    const slug = this.attributes['data-slug'].value;
    graphState.hover({ slug });
  }

  function mouseleave() {
    graphState.hover(null);
  }

  /**
   * @param {HTMLLinkElement} linkElement
   */
  function unregisterEvents(linkElement) {
    linkElement.addEventListener('mouseenter', mouseenter);
    linkElement.addEventListener('mouseleave', mouseleave);
  }

  /** @type {Map<string,Array<HTMLLinkElement>>} */
  let contentNoteLinks;
  onMount(() => {
    contentNoteLinks = new Map();

    /** @type {NodeListOf<HTMLLinkElement>} */
    const noteLinks = document.querySelectorAll('#note-content a[data-slug]');
    for (const link of noteLinks) {
      const linkSlug = link.attributes['data-slug'].value;
      if (!contentNoteLinks.has(linkSlug)) {
        contentNoteLinks.set(linkSlug, []);
      }
      contentNoteLinks.get(linkSlug).push(link);
    }

    for (const link of noteLinks) {
      registerEvents(link);
    }

    () => {
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

      for (const link of contentNoteLinks.get(lastHoveredSlug)) {
        link.classList.remove('hovered-link');
      }
      lastHoveredSlug = null;
      return;
    }

    const links = contentNoteLinks.get(hoveredNote.slug);
    if (!links) return;

    for (const link of links) {
      link?.classList.add('hovered-link');
    }
    lastHoveredSlug = hoveredNote.slug;
  }

  $: if (graphState && contentNoteLinks && $graphState.hoveredNote?.slug != lastHoveredSlug)
    reflectHoveredNote($graphState.hoveredNote);
</script>

<div id="note-content">
  <slot />
</div>

<style>
  @media (prefers-color-scheme: dark) {
    #note-content :global(.hovered-link) {
      color: #fff;
    }
  }

  @media (prefers-color-scheme: light) {
    #note-content :global(.hovered-link) {
      color: #000;
    }
  }
</style>
