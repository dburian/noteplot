<!--
  The line between two columns.

  Purely visual: columns share the space equally (`flex-1`) and per-column
  resizing is out of scope. It is deliberately the same box as
  `shell/PaneDivider.svelte` — `shrink-0 w-1` — so making it draggable later is
  adding handlers, not redoing the layout.
-->
<div
  role="separator"
  aria-orientation="vertical"
  class="shrink-0 w-1 bg-muted-light dark:bg-muted-dark"
/>
