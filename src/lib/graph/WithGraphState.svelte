<script>
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import { setContext } from 'svelte';

  /**
   * Only the slug and the title are ever read off the active note. Keeping the
   * whole note would put its rendered HTML in the store (ISSUES.md B9).
   *
   * @param {{slug: string, title: string} | null | undefined} note
   * @returns {{slug: string, title: string} | null}
   */
  function toNoteRef(note) {
    return note ? { slug: note.slug, title: note.title } : null;
  }

  function extractGraphStateFromPageData(pageData) {
    return {
      activeNote: toNoteRef(pageData.note),
      hoveredNote: null,
      showConnections: true,
      showTagsGlow: true
    };
  }

  function createGraphState(pageData) {
    const { subscribe, update } = writable(extractGraphStateFromPageData(pageData));

    function hover(note) {
      update((values) => ({ ...values, hoveredNote: note }));
    }

    /** @param {boolean} flag */
    function showConnections(flag) {
      update((values) => ({ ...values, showConnections: flag }));
    }

    /** @param {boolean} flag */
    function showTagsGlow(flag) {
      update((values) => ({ ...values, showTagsGlow: flag }));
    }

    return { subscribe, update, hover, showConnections, showTagsGlow };
  }

  const graphState = createGraphState($page.data);

  $: if ($graphState.activeNote?.slug != $page.data.note?.slug) {
    graphState.update((values) => ({ ...values, activeNote: toNoteRef($page.data.note) }));
  }

  setContext('graphState', graphState);
</script>

<slot />
