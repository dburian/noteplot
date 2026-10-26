<script>
  import { matchCommands } from '$lib/commands/match.js';
  import CommandRow from '$lib/commands/CommandRow.svelte';
  import OverlayEmpty from './OverlayEmpty.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import SearchBar from '$lib/search/SearchBar.svelte';
  import {
    useAppState,
    COMMANDS,
    FILTER,
    LAYOUT,
    OVERLAY,
    PREFS,
    TILES,
    VIZ
  } from '$lib/state/keys.js';

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
  const { list: commands } = /** @type {import('$lib/commands/registry.js').Commands} */ (
    useAppState(COMMANDS)
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
      filter: $filter,
      overlay: $overlay
    }
  };

  $: ctx.values = {
    layout: $layout,
    tiles: $tiles,
    prefs: $prefs,
    viz: $viz,
    filter: $filter,
    overlay: $overlay
  };

  // Shortcut-only commands (open the palette, close the overlay) mean nothing
  // from inside the palette.
  const listed = commands.filter((command) => command.palette !== false);

  let value = '';
  let highlight = 0;

  $: entries = matchCommands(listed, value).map(({ command }) => ({
    command,
    enabled: command.enabled ? command.enabled(ctx) : true
  }));

  // Filtering the list out from under the cursor must not leave it pointing
  // past the end.
  $: if (highlight >= entries.length) highlight = 0;

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

<OverlayShell title="Command palette" on:close={overlay.close}>
  <SearchBar
    slot="input"
    bind:value
    placeholder="Type a command"
    debounceTime={0}
    on:search={() => (highlight = 0)}
    on:keydown={onKeydown}
  />

  {#each entries as entry, i (entry.command.id)}
    <CommandRow
      {entry}
      active={i === highlight}
      on:click={() => runAt(i)}
      on:mouseenter={() => (highlight = i)}
    />
  {:else}
    <OverlayEmpty><p class="text-sm">no command</p></OverlayEmpty>
  {/each}

  <footer
    slot="footer"
    class="shrink-0 truncate px-3 py-1.5 text-xs text-muted-light dark:text-muted-dark
           border-t border-t-muted-light dark:border-t-muted-dark"
  >
    ↑↓ move · ↵ run · Esc close
  </footer>
</OverlayShell>
