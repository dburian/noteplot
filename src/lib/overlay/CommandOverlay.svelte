<script>
  import { matchCommands } from '$lib/commands/match.js';
  import { commands } from '$lib/commands/registry.js';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import { useAppState, FILTER, LAYOUT, OVERLAY, PREFS, TILES, VIZ } from '$lib/state/keys.js';

  /**
   * The command palette. Everything the toolbar can do, by name.
   *
   * `debounceTime={0}` on the input: matching a dozen static strings is
   * instant, and a 250 ms lag between a keystroke and the list moving is very
   * noticeable when the list is short.
   */

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const tiles = /** @type {import('$lib/state/tiles.js').TilesStore} */ (useAppState(TILES));
  const prefs = /** @type {import('$lib/state/prefs.js').PrefsStore} */ (useAppState(PREFS));
  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));
  const filter = /** @type {import('$lib/state/filter.js').FilterStore} */ (useAppState(FILTER));
  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );

  /**
   * The bag every command is handed. Assembled once — the stores in it are
   * stable for the app's lifetime — with one mutable field:
   *
   * `values` is a snapshot, refreshed below rather than rebuilt, because
   * `enabled(ctx)` has to answer against the *current* state and a command that
   * toggles a setting has to read the current one to flip it. Assigning through
   * `ctx` invalidates `ctx`, so the `entries` block re-runs and a command greys
   * out the moment it stops being available.
   *
   * @type {import('$lib/commands/registry.js').CommandContext}
   */
  const ctx = {
    layout,
    tiles,
    prefs,
    viz,
    filter,
    overlay,
    values: {
      layout: $layout,
      tiles: $tiles,
      prefs: $prefs,
      viz: $viz,
      filter: $filter
    }
  };

  $: ctx.values = {
    layout: $layout,
    tiles: $tiles,
    prefs: $prefs,
    viz: $viz,
    filter: $filter
  };

  let value = '';
  let highlight = 0;

  $: entries = matchCommands(commands, value).map(({ command }) => ({
    command,
    enabled: command.enabled ? command.enabled(ctx) : true
  }));

  // Filtering the list out from under the cursor must not leave it pointing
  // past the end.
  $: if (highlight >= entries.length) highlight = 0;

  /** @type {HTMLElement | undefined} */
  let listEl;

  // Same job as `SearchMatch`'s own `scrollIntoView`, done from here because a
  // command row is a plain button rather than a component.
  $: if (listEl && entries.length) {
    listEl.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }

  /** @param {number} i */
  function runAt(i) {
    const entry = entries[i];
    if (!entry || !entry.enabled) return;

    // Close **first**, then run. `overlay.search` and `overlay.filter` open an
    // overlay; closing afterwards would immediately undo them.
    overlay.close();
    entry.command.run(ctx);
  }

  /** @param {KeyboardEvent} ev */
  function onKeydown(ev) {
    const count = entries.length;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (count) highlight = (highlight + 1) % count;
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (count) highlight = (highlight - 1 + count) % count;
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      runAt(highlight);
    }
  }
</script>

<SearchBar
  bind:value
  placeholder="Type a command"
  debounceTime={0}
  on:search={() => (highlight = 0)}
  on:keydown={onKeydown}
/>

<div bind:this={listEl} class="flex-1 min-h-0 overflow-y-auto py-1">
  {#each entries as entry, i (entry.command.id)}
    <button
      type="button"
      class="w-full flex items-baseline gap-3 px-3 py-1.5 text-left border-l-2
             {i === highlight
        ? 'border-l-emphasis-light dark:border-l-emphasis-dark bg-muted-light/20 dark:bg-muted-dark/20'
        : 'border-l-transparent hover:bg-muted-light/10 dark:hover:bg-muted-dark/10'}
             {entry.enabled
        ? 'text-front-light dark:text-front-dark'
        : 'text-muted-light dark:text-muted-dark'}"
      disabled={!entry.enabled}
      on:click={() => runAt(i)}
      on:mouseenter={() => (highlight = i)}
    >
      <span class="flex-1 min-w-0 truncate">{entry.command.title}</span>
      {#if entry.command.group}
        <span class="shrink-0 text-xs text-muted-light dark:text-muted-dark">
          {entry.command.group}
        </span>
      {/if}
    </button>
  {:else}
    <p class="px-3 py-6 text-center text-sm text-muted-light dark:text-muted-dark">no command</p>
  {/each}
</div>

<footer
  class="shrink-0 px-3 py-1.5 text-xs text-muted-light dark:text-muted-dark
         border-t border-t-muted-light dark:border-t-muted-dark"
>
  ↑↓ move · ↵ run · Esc close
</footer>
