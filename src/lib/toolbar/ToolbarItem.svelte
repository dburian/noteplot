<script>
  import ToolbarButton from './ToolbarButton.svelte';

  /**
   * One control in the top strip: an optional lead glyph, an optional inline
   * label, and a native `title=` tooltip.
   *
   * This replaces `DesktopToolbarButton.svelte`, whose tweened slide-out label
   * existed only because a vertical icon strip had no room for text. Horizontal
   * space is no longer scarce, so the label is simply always there.
   *
   * Items are **text-only for now** — no icon set has been drawn yet. The
   * `lead` slot is where one goes when it is.
   */

  /** Inline text. Omit it and the item is whatever the slots render. @type {string} */
  export let label = '';
  /** @type {string} */
  export let title = '';
  /**
   * Padding, as a prop rather than something a caller can override through
   * `class`. Tailwind resolves competing utilities by their order in the
   * generated stylesheet, not by the order they appear in the attribute, so a
   * `class="px-1.5"` passed alongside a hard-coded `px-2` silently loses.
   *
   * @type {string}
   */
  export let padding = 'px-2 py-1';
  /** @type {boolean} */
  export let active = false;

  /**
   * Ghost by default, filled when active. Overriding `activeColor` per call
   * site is how a control gets its own hue; both stay literal strings.
   *
   * @type {string}
   */
  export let activeColor = 'bg-front-light text-back-light dark:bg-front-dark dark:text-back-dark';
  /** @type {string} */
  export let defaultColor =
    'bg-transparent text-front-light dark:text-front-dark ' +
    'hover:bg-muted-light/25 dark:hover:bg-muted-dark/25 ' +
    'hover:text-emphasis-light dark:hover:text-emphasis-dark';

  /** @type {string} */
  let classNames = '';
  export { classNames as class };
</script>

<ToolbarButton
  on:click
  on:auxclick
  on:mousedown
  on:mouseenter
  on:mouseleave
  {active}
  {activeColor}
  {defaultColor}
  title={title || label}
  class={`${classNames} ${padding}`}
>
  <slot name="lead" />
  {#if label}<span class="whitespace-nowrap">{label}</span>{/if}
  <slot />
</ToolbarButton>
