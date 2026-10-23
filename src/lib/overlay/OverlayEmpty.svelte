<script>
  /**
   * The overlay's nothing-to-show block: the hint before you type, "searching
   * …", and "no match".
   *
   * A whole pane makes the small top-anchored `py-6` paragraph these used to be
   * look mislaid, so this centres them in the upper part of the pane instead,
   * with `grid place-content-center`.
   *
   * `min-h-[40vh]` rather than filling the body: the block should sit where the
   * first results would have been, not float in the middle of a tall pane.
   */
</script>

<div
  class="grid min-h-[40vh] place-content-center gap-1 px-4 text-center select-none
         text-muted-light dark:text-muted-dark"
>
  <slot />
</div>
