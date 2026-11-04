<script>
  /**
   * A left-ruled aside: the parsed-query readout in the search and filter
   * overlays.
   *
   * The margin is a **prop**, not something a caller passes through `class`.
   * Tailwind resolves competing utilities by their order in the generated
   * stylesheet rather than in the attribute, so a `class="mb-0"` alongside a
   * hard-coded `mb-10` silently loses — the same trap `ToolbarItem`'s `padding`
   * prop exists for. The overlays pass `mb-0`: a paragraph-sized gap under a
   * readout that sits directly above the result list reads as a section break
   * that is not there.
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
