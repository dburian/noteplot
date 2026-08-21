<script>
  import VizSection from './VizSection.svelte';
  import HistorySection from './HistorySection.svelte';
  import ContentSection from './ContentSection.svelte';

  /**
   * One horizontal strip across the top of the window, in three sections:
   * the visualization and its controls, the recently-viewed chips, and the
   * content-area controls.
   *
   * The outer two size to their content; the history row takes the slack and
   * scrolls. That is the whole reason the redesign has a top toolbar — the
   * vertical strip it replaces positioned seven buttons with `absolute` and
   * `left-[-100%]`, implicitly coupled to the content pane's `max-width`, and
   * adding a control meant finding pixels.
   */
</script>

<div
  class="shrink-0 h-10 flex items-center gap-3 px-3
         border-b border-b-muted-light dark:border-b-muted-dark"
>
  <VizSection />
  <HistorySection />
  <ContentSection />
</div>
