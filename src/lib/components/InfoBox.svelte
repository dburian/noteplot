<script>
  /**
   * A left-ruled aside: the note metadata block, and the parsed-query readout
   * in the search and filter overlays.
   *
   * The margin is a **prop**, not something a caller passes through `class`.
   * Tailwind resolves competing utilities by their order in the generated
   * stylesheet rather than in the attribute, so a `class="mb-0"` alongside a
   * hard-coded `mb-10` silently loses — the same trap `ToolbarItem`'s `padding`
   * prop exists for. An overlay panel is 70vh tall and cannot afford `mb-10`.
   *
   * @type {string}
   */
  export let margin = 'mb-10';
</script>

<section
  class="{margin} border-l-2 border-l-muted-light dark:border-l-muted-dark pl-4 py-1 text-sm
         prose-high-level-tag"
>
  <slot />
</section>
