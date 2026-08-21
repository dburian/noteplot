<script>
  import { createEventDispatcher } from 'svelte';

  /**
   * The backdrop and the panel every overlay screen sits in. The screens
   * themselves are just a `SearchBar`, a scrolling body and a footer hint —
   * none of them repeats this box.
   *
   * `absolute inset-0` against `ContentPane`'s `relative`, deliberately: the
   * modal covers the content area only, so the toolbar stays clickable and the
   * visualization stays visible *and usable* underneath while you search. That
   * is also why the layout is nudged out of `viz` mode when an overlay opens
   * (see `state/WithAppState.svelte`) — in that mode the content pane, and so
   * this box, does not exist.
   *
   * Escape is **not** handled here. `AppShell` has one window-level handler for
   * it, so there is a single closer rather than two racing to call the same
   * action.
   */

  /** Accessible name for the dialog. @type {string} */
  export let title = '';

  const dispatch = createEventDispatcher();
</script>

<!--
  A backdrop click closes; `|self` keeps a click that lands on the panel from
  bubbling up as one. There is no key handler on it because Escape lives at the
  window — see above.
-->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="absolute inset-0 z-20 flex justify-center px-4 pt-[10vh]
         bg-back-light/80 dark:bg-back-dark/80 backdrop-blur-sm"
  on:click|self={() => dispatch('close')}
>
  <div
    class="w-full max-w-2xl max-h-[70vh] flex flex-col rounded-lg shadow-xl overflow-hidden
           border border-muted-light dark:border-muted-dark
           bg-back-light dark:bg-back-dark"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <slot />
  </div>
</div>
