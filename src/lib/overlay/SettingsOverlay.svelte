<script>
  import { onMount } from 'svelte';

  import Button from '$lib/components/Button.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import { useAppState, OVERLAY, PREFS } from '$lib/state/keys.js';

  /**
   * The settings screen: the sticky preferences, and a way into each settings
   * sub-page. The sub-pages are overlay kinds of their own (`shortcuts`), so
   * going into one is `overlay.open` and the URL follows.
   *
   * There is no `SearchBar` here to take initial focus, so the first control
   * claims it — otherwise focus stays on whatever opened the overlay, outside
   * the dialog.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));

  /** @type {HTMLInputElement} */
  let firstControl;
  onMount(() => firstControl.focus());
</script>

<OverlayShell title="Settings" on:close={overlay.close}>
  <section class="px-4 py-2">
    <h2 class="pb-2 text-xs uppercase tracking-wide text-muted-light dark:text-muted-dark">
      Content
    </h2>
    <label class="flex cursor-pointer items-start gap-3 py-2">
      <input
        bind:this={firstControl}
        type="checkbox"
        class="mt-1"
        checked={$prefs.showMeta}
        on:change={(ev) => prefs.setShowMeta(ev.currentTarget.checked)}
      />
      <span>
        <span class="block">Show note metadata</span>
        <span class="block text-sm text-muted-light dark:text-muted-dark">
          Each note's frontmatter, backlinks and reading time, and the parsed query in search and
          filter.
        </span>
      </span>
    </label>
  </section>

  <section class="px-4 py-2">
    <h2 class="pb-2 text-xs uppercase tracking-wide text-muted-light dark:text-muted-dark">
      Keyboard
    </h2>
    <Button
      class="flex w-full items-center gap-3 rounded px-2 py-2 -mx-2 text-left
             hover:bg-muted-light/10 dark:hover:bg-muted-dark/10"
      on:click={() => overlay.open('shortcuts')}
    >
      <span class="min-w-0 flex-1">
        <span class="block">Keyboard shortcuts</span>
        <span class="block text-sm text-muted-light dark:text-muted-dark">
          Change the key for any command.
        </span>
      </span>
      <span class="shrink-0 text-muted-light dark:text-muted-dark" aria-hidden="true">›</span>
    </Button>
  </section>
</OverlayShell>
