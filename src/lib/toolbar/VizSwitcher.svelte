<script>
  import { useAppState, LAYOUT, VIZ } from '$lib/state/keys.js';
  import { getVisualization, visualizations } from '$lib/viz/registry.js';
  import ToolbarItem from './ToolbarItem.svelte';

  /**
   * The active visualization's name, and the layout cycle hanging off it.
   *
   * **Clicking the name cycles the layout** (split → viz → content → split).
   * That is the primary way to change the layout, which is why the current mode
   * rides along as a glyph rather than living in a separate control: the label
   * is the biggest target in the toolbar and it has to be obvious that it does
   * something.
   *
   * It must also stay visible in every mode. `layout.confirmFraction()` snaps
   * to `content`-only below 0.1, and in `content` mode the divider is
   * unmounted — without this button a full drag left is a dead end.
   *
   * The chevron enumerates the registry. With one entry the menu has one item,
   * and that is deliberate: the enumeration is the point.
   */

  const layout = /** @type {import('$lib/state/layout.js').LayoutStore} */ (useAppState(LAYOUT));
  const viz = /** @type {import('$lib/state/viz.js').VizStore} */ (useAppState(VIZ));

  /** @type {Record<import('$lib/state/layout.js').LayoutMode, string>} */
  const glyph = { split: '▯▮', viz: '▮', content: '▯' };
  /** @type {Record<import('$lib/state/layout.js').LayoutMode, string>} */
  const modeName = { split: 'split', viz: 'visualization only', content: 'content only' };

  $: active = getVisualization($viz.activeId);

  let open = false;

  /** @param {string} id */
  function pick(id) {
    viz.setActive(id);
    open = false;
  }

  /**
   * Escape closes the menu. Deliberately does not stop propagation: sibling
   * `window` listeners do not see each other's `stopPropagation` anyway, and
   * `AppShell` has the app's own Escape handler. Nothing is lost — that one
   * returns early unless an overlay is open, and an overlay cannot be open
   * while this menu is.
   *
   * @param {KeyboardEvent} ev
   */
  function onKeydown(ev) {
    if (ev.key === 'Escape') open = false;
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="relative flex items-center">
  <ToolbarItem
    label={active.label}
    title={`Layout: ${modeName[$layout.mode]}. Click to cycle: split → visualization → content`}
    on:click={layout.cycle}
  >
    <span slot="lead" class="text-xs tracking-tighter" aria-hidden="true"
      >{glyph[$layout.mode]}</span
    >
  </ToolbarItem>

  <ToolbarItem
    label="⌄"
    title="Choose visualization"
    active={open}
    padding="px-1.5 py-1"
    on:click={() => (open = !open)}
  />

  {#if open}
    <!-- A full-viewport click target behind the menu. Cheaper and more reliable
         than a document listener that has to be added, removed, and taught not
         to fire on the click that opened the menu. -->
    <button
      type="button"
      class="fixed inset-0 z-10 cursor-default"
      aria-label="Close visualization menu"
      on:click={() => (open = false)}
    ></button>
    <ul
      class="absolute left-0 top-full z-20 mt-1 min-w-[12rem] py-1 rounded shadow-lg
             border border-muted-light dark:border-muted-dark
             bg-back-light dark:bg-back-dark"
    >
      {#each visualizations as v (v.id)}
        <li>
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left select-none
                   text-front-light dark:text-front-dark
                   hover:bg-muted-light/25 dark:hover:bg-muted-dark/25"
            on:click={() => pick(v.id)}
          >
            <span class="w-3 shrink-0" aria-hidden="true">{v.id === active.id ? '•' : ''}</span>
            {v.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
