<script>
  import Button from '$lib/components/Button.svelte';
  import { rowClass } from '$lib/overlay/row_style.js';

  /**
   * One row in the command palette.
   *
   * Extracted out of `CommandOverlay` so it can scroll itself into view the way
   * `SearchMatch` does. The overlay used to reach into `listEl.children[i]` for
   * that, which only worked while every child was a row and the cursor index
   * matched a DOM position — the empty state and any future group heading both
   * break that.
   *
   * Disabled commands stay listed and greyed rather than disappearing: hiding
   * them would make the palette's vocabulary depend on the state you happen to
   * be in. `disabled` also keeps them out of the overlay's tab ring.
   */

  /** @type {{command: import('./registry.js').Command, enabled: boolean}} */
  export let entry;

  /** Whether ↑/↓ has this row under the cursor. @type {boolean} */
  export let active = false;

  /** @type {HTMLButtonElement | null} */
  let button = null;

  $: if (active && button) button.scrollIntoView({ block: 'nearest' });
</script>

<Button
  bind:button
  disabled={!entry.enabled}
  class="{rowClass(active)} px-4 py-2 {entry.enabled
    ? 'text-front-light dark:text-front-dark'
    : 'text-muted-light dark:text-muted-dark'}"
  on:click
  on:mouseenter
>
  <span class="flex items-baseline gap-3">
    <span class="min-w-0 truncate">{entry.command.title}</span>
    {#if entry.command.group}
      <span class="ml-auto shrink-0 text-xs text-muted-light dark:text-muted-dark">
        {entry.command.group}
      </span>
    {/if}
  </span>
  {#if entry.command.description}
    <span class="mt-0.5 block truncate text-sm text-muted-light dark:text-muted-dark">
      {entry.command.description}
    </span>
  {/if}
</Button>
