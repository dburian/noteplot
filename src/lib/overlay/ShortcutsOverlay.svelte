<script>
  import { onMount } from 'svelte';

  import Button from '$lib/components/Button.svelte';
  import OverlayShell from './OverlayShell.svelte';
  import { recordChord } from './record_chord.js';
  import { commands, commandsById } from '$lib/commands/registry.js';
  import { formatChord } from '$lib/commands/chord.js';
  import { useAppState, OVERLAY, SHORTCUTS } from '$lib/state/keys.js';

  /**
   * Settings › Keyboard shortcuts: every command, its chords, and the controls
   * to change them.
   *
   * Every command is listed, the shortcut-only ones too, grouped as the palette
   * groups them. A chord is a chip with a ✕; `+` records a new one via
   * `record_chord.js`, which hides the keypress from `AppShell` so even Escape
   * can be bound. A chord already in use moves to the new command, and the row
   * says where it came from — refusing would leave no way to swap two keys.
   *
   * This screen only edits `state/shortcuts.js`. `AppShell` reads the same
   * store on every keydown, so a new binding works the moment it is recorded.
   */

  const overlay = /** @type {import('$lib/state/overlay.js').OverlayStore} */ (
    useAppState(OVERLAY)
  );
  const shortcuts = /** @type {import('$lib/state/shortcuts.js').ShortcutsStore} */ (
    useAppState(SHORTCUTS)
  );

  /** @type {('Layout'|'Content'|'Visualization'|'Navigation')[]} */
  const GROUPS = ['Layout', 'Content', 'Visualization', 'Navigation'];
  const sections = [
    ...GROUPS.map((group) => ({ group, items: commands.filter((c) => c.group === group) })),
    { group: 'Other', items: commands.filter((c) => !c.group) }
  ].filter((section) => section.items.length > 0);

  /** The command whose `+` is waiting for a keypress. @type {string | null} */
  let recording = null;

  /** The last chord that moved between commands. @type {{id: string, chord: string, from: string} | null} */
  let moved = null;

  /** @type {HTMLButtonElement | null} */
  let backButton = null;
  onMount(() => backButton?.focus());

  /**
   * @param {string} id
   * @param {string} chord
   */
  function record(id, chord) {
    recording = null;
    const from = shortcuts.add(id, chord);
    moved = from ? { id, chord, from } : null;
  }

  /** @param {string} id */
  function titleOf(id) {
    return commandsById.get(id)?.title ?? id;
  }
</script>

<OverlayShell title="Settings › Keyboard shortcuts" on:close={overlay.close}>
  <div
    slot="input"
    class="shrink-0 flex items-center gap-2 px-3 py-1.5
           border-b border-b-muted-light dark:border-b-muted-dark"
  >
    <Button
      bind:button={backButton}
      class="px-2 py-0.5 text-sm rounded transition-colors
             text-muted-light dark:text-muted-dark
             hover:bg-muted-light/20 dark:hover:bg-muted-dark/20
             focus-visible:bg-muted-light/20 dark:focus-visible:bg-muted-dark/20"
      on:click={() => overlay.open('settings')}
    >
      ‹ Settings
    </Button>
  </div>

  {#each sections as section (section.group)}
    <section class="px-4 py-2">
      <h2 class="pb-1 text-xs uppercase tracking-wide text-muted-light dark:text-muted-dark">
        {section.group}
      </h2>

      {#each section.items as command (command.id)}
        {@const chords = $shortcuts.bindings[command.id] ?? []}
        <div class="flex items-center gap-3 py-1.5">
          <span class="min-w-0 flex-1">
            <span class="block truncate">{command.title}</span>
            {#if moved && moved.id === command.id}
              <span class="block truncate text-xs text-emphasis-light dark:text-emphasis-dark">
                {formatChord(moved.chord)} moved here from “{titleOf(moved.from)}”
              </span>
            {/if}
          </span>

          <span class="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {#each chords as chord (chord)}
              <span
                class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs
                       border-muted-light dark:border-muted-dark"
              >
                {formatChord(chord)}
                <Button
                  title="Remove {formatChord(chord)}"
                  class="text-muted-light dark:text-muted-dark
                         hover:text-front-light dark:hover:text-front-dark"
                  on:click={() => shortcuts.remove(command.id, chord)}
                >
                  ✕
                </Button>
              </span>
            {/each}

            {#if recording === command.id}
              <button
                type="button"
                class="rounded border border-dashed px-1.5 py-0.5 text-xs outline-none
                       border-emphasis-light dark:border-emphasis-dark
                       text-emphasis-light dark:text-emphasis-dark"
                use:recordChord={{
                  onChord: (chord) => record(command.id, chord),
                  onCancel: () => (recording = null)
                }}
              >
                press a key…
              </button>
            {:else}
              <Button
                title="Add a shortcut for {command.title}"
                class="rounded px-1.5 py-0.5 text-xs transition-colors
                       text-muted-light dark:text-muted-dark
                       hover:bg-muted-light/20 dark:hover:bg-muted-dark/20
                       focus-visible:bg-muted-light/20 dark:focus-visible:bg-muted-dark/20"
                on:click={() => {
                  moved = null;
                  recording = command.id;
                }}
              >
                + key
              </Button>
            {/if}

            {#if command.id in $shortcuts.overrides}
              <Button
                title="Restore the default shortcut"
                class="rounded px-1.5 py-0.5 text-xs transition-colors
                       text-muted-light dark:text-muted-dark
                       hover:bg-muted-light/20 dark:hover:bg-muted-dark/20
                       focus-visible:bg-muted-light/20 dark:focus-visible:bg-muted-dark/20"
                on:click={() => shortcuts.reset(command.id)}
              >
                reset
              </Button>
            {/if}
          </span>
        </div>
      {/each}
    </section>
  {/each}

  <footer
    slot="footer"
    class="shrink-0 flex items-center gap-3 px-3 py-1.5 text-xs text-muted-light dark:text-muted-dark
           border-t border-t-muted-light dark:border-t-muted-dark"
  >
    <span class="min-w-0 flex-1 truncate">
      While typing in a text field, only “Close overlay” shortcuts work.
    </span>
    <Button
      class="shrink-0 rounded px-2 py-0.5 transition-colors
             hover:bg-muted-light/20 dark:hover:bg-muted-dark/20"
      on:click={() => {
        moved = null;
        shortcuts.resetAll();
      }}
    >
      Reset all
    </Button>
  </footer>
</OverlayShell>
