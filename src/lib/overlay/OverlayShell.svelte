<script>
  import { createEventDispatcher } from 'svelte';

  import Button from '$lib/components/Button.svelte';
  import { focusTrap } from './focus_trap.js';

  /**
   * The frame every overlay screen sits in: a header, the screen's input, a
   * scrolling body, and the screen's footer hint. Each screen mounts one of
   * these itself and fills the slots — none of them repeats the box, and the
   * `flex-1 min-h-0 overflow-y-auto` body that used to be written out three
   * times lives here once.
   *
   * **It fills the content pane.** `absolute inset-0` against `ContentPane`'s
   * `relative`, opaque, edge to edge — not the top-anchored `max-w-2xl`
   * `max-h-[70vh]` card it replaces, whose sizes were measured against the
   * viewport while the box they sat in was a ~38% flex share of it. The pane is
   * still the anchor, deliberately: the toolbar stays clickable and the
   * visualization stays visible *and usable* beside you while you search, which
   * matters most for the filter, whose whole output is a change to the graph.
   * That is also why the layout is nudged out of `viz` mode when an overlay
   * opens (see `state/WithAppState.svelte`) — in that mode the content pane,
   * and so this box, does not exist.
   *
   * `focusTrap` keeps Tab inside the dialog. Restoring focus to whatever opened
   * the overlay is **not** here, though: each screen mounts its own shell, so
   * switching kinds — the palette's own "Search notes" command — tears this
   * component down and builds another, and a capture at init would record the
   * outgoing screen's input as the opener. `OverlayHost` outlives that switch
   * and owns it.
   *
   * Escape is **not** handled here. `AppShell` has one window-level handler for
   * it, so there is a single closer rather than two racing to call the same
   * action. The header's ✕ is the other one, and it exists because an opaque
   * surface has no backdrop left to click.
   */

  /** Accessible name for the dialog, and the header's label. @type {string} */
  export let title = '';

  const dispatch = createEventDispatcher();
</script>

<div
  class="absolute inset-0 z-20 flex flex-col bg-back-light dark:bg-back-dark"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  use:focusTrap
>
  <!--
    `h-10` is the toolbar's height, so this header reads as a second bar under
    the real one rather than as a floating caption.
  -->
  <header
    class="shrink-0 h-10 flex items-center gap-2 px-3
           border-b border-b-muted-light dark:border-b-muted-dark"
  >
    <span class="min-w-0 truncate text-sm text-front-light dark:text-front-dark">{title}</span>
    <span class="flex-1"></span>
    <span class="shrink-0 text-xs text-muted-light dark:text-muted-dark select-none">esc</span>
    <Button
      title="Close"
      class="shrink-0 px-2 py-0.5 text-sm rounded transition-colors
             text-muted-light dark:text-muted-dark
             hover:bg-muted-light/20 dark:hover:bg-muted-dark/20"
      on:click={() => dispatch('close')}
    >
      ✕
    </Button>
  </header>

  <slot name="input" />

  <!--
    The scroller is the full width of the pane so its scrollbar sits at the pane
    edge; the list inside is capped and centred, because in `content` mode the
    pane is the whole window and nothing else in this app sets text that wide —
    `Prose.svelte` caps a note at 65ch for the same reason.
  -->
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl py-2">
      <slot />
    </div>
  </div>

  <slot name="footer" />
</div>
