<script>
  import Button from '$lib/components/Button.svelte';

  /**
   * The colour layer: a `<button>` that swaps between two Tailwind class
   * strings depending on `active`.
   *
   * Both must be **literal strings** at the call site — Tailwind's content
   * scanner cannot see a class name that was computed at runtime.
   *
   * It no longer forces `text-back-*`. That was correct while every toolbar
   * button was a filled colour square floating over the canvas; in the top
   * strip the resting state is transparent, and a back-coloured label on it is
   * invisible. The text colour now travels with `defaultColor`/`activeColor`,
   * which is the only way a ghost resting state and a filled active state can
   * both be expressed.
   */

  /** @type {string} */
  export let activeColor;
  /** @type {string} */
  export let defaultColor;
  /** @type {boolean} */
  export let active = false;
  /** @type {string} */
  export let title = '';

  /** @type {HTMLButtonElement | null} */
  export let button = null;
  /** @type {string} */
  let classNames = '';
  export { classNames as class };
</script>

<Button
  on:click
  on:auxclick
  on:mousedown
  on:mouseenter
  on:mouseleave
  bind:button
  {title}
  class={`${classNames} ` +
    // `inline-flex`, not the `grid content-center` this used to be: an item is
    // a row of things now (a mode glyph and a label, a label and a badge), and
    // grid would stack them.
    `inline-flex items-center gap-1.5 text-sm rounded ` +
    `transition-colors ` +
    `${active ? activeColor : defaultColor}`}
>
  <slot />
</Button>
