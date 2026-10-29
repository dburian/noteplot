<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  /**
   * The one text input, used by all three overlays. It goes in `OverlayShell`'s
   * `input` slot, directly under the frame's own title bar.
   *
   * It changed shape in the redesign: it used to be a bordered `text-xl` box
   * with a `mb-6` under it, sized for the middle of a full `/search` page. The
   * pages are gone; this is a query bar under a header now, and it owns the
   * border between itself and the results — the frame does not draw one there.
   *
   * It also still owns the overlay's **initial focus**, via the `onMount`
   * autofocus below. `overlay/focus_trap.js` deliberately focuses nothing, so
   * there is one claimant rather than two racing.
   *
   * Three behavioural changes came with that, all of them relied on:
   *
   * - **It fires on `input`, not `keydown`.** `keydown` runs *before* the value
   *   updates, so the old version dispatched the text as it was one keystroke
   *   ago. The 250 ms debounce hid it — the timer outlived the gap — but it
   *   surfaced on `debounceTime = 0`, which the command palette uses.
   * - **`value` is a prop**, so `?q=` can seed the field on open.
   * - **`keydown` is forwarded**, because ↑/↓/Enter have to reach the list
   *   while focus stays in the input.
   */

  /** Bindable current text. @type {string} */
  export let value = '';
  /** @type {string} */
  export let placeholder = 'Search for something…';
  /** Milliseconds of quiet before `search` fires. `0` dispatches synchronously. @type {number} */
  export let debounceTime = 250;
  /** @type {boolean} */
  export let autofocus = true;

  const dispatch = createEventDispatcher();

  /** @type {HTMLInputElement | undefined} */
  let inputEl;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  /** Whether a debounced dispatch is owed. Read by `flush`. */
  let pending = false;

  function fire() {
    pending = false;
    dispatch('search', { searchString: value });
  }

  function schedule() {
    clearTimeout(timer);
    if (debounceTime <= 0) {
      fire();
      return;
    }
    pending = true;
    timer = setTimeout(fire, debounceTime);
  }

  /**
   * Dispatch the owed `search` now instead of waiting out the debounce — what
   * Enter does in the filter overlay.
   *
   * **A no-op when nothing is pending**, and that guard is the point: a filter
   * search re-runs `index.search` and writes a fresh `results` array, which
   * `CanvasGraph.onFilterChange` compares by reference. Flushing
   * unconditionally would redraw the whole graph on every Enter press.
   */
  export function flush() {
    if (!pending) return;
    clearTimeout(timer);
    fire();
  }

  export function focus() {
    inputEl?.focus();
  }

  function clear() {
    value = '';
    clearTimeout(timer);
    fire();
    inputEl?.focus();
  }

  onMount(() => {
    if (autofocus) inputEl?.focus();
  });

  // The overlay unmounts this component the moment it closes; a timer left
  // running would dispatch into a dead component.
  onDestroy(() => clearTimeout(timer));
</script>

<div
  class="shrink-0 flex items-center gap-2 px-3
         border-b border-b-muted-light dark:border-b-muted-dark"
>
  <input
    type="text"
    class="flex-1 min-w-0 py-2.5 bg-transparent text-base
           placeholder:text-muted-light dark:placeholder:text-muted-dark
           focus-visible:outline-none"
    {placeholder}
    autocomplete="off"
    spellcheck="false"
    bind:value
    bind:this={inputEl}
    on:input={schedule}
    on:keydown
  />
  {#if value}
    <button
      type="button"
      class="shrink-0 select-none px-2 py-0.5 text-xs rounded
             text-muted-light dark:text-muted-dark
             hover:bg-muted-light/25 dark:hover:bg-muted-dark/25
             hover:text-emphasis-light dark:hover:text-emphasis-dark"
      title="Clear"
      on:click={clear}
    >
      clear
    </button>
  {/if}
</div>
