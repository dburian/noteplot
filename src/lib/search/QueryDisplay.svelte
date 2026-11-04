<script>
  import InfoBox from '$lib/components/InfoBox.svelte';
  import { FIELDS } from './query.js';

  /**
   * What `parseSearchString` made of what you typed — which fields each term
   * is looked up in, how it matches, and the path filters. Everything listed
   * must hold (AND).
   *
   * In the overlays this is behind the settings overlay's **search details**
   * toggle, the same switch that shows each row's matched fields: both answer
   * "show me the machinery", and neither is something you want in the way by
   * default.
   *
   * @type {import('./query.js').ParsedQuery | null}
   */
  export let query;

  /** Passed through to `InfoBox`; the overlays want `mb-0`. @type {string} */
  export let margin = 'mb-10';

  /** @param {import('./query.js').QueryBlock} block */
  function how(block) {
    if (block.phrase) return 'phrase';
    if (block.exact) return 'exact';
    return [block.prefix && 'prefix', block.fuzzy && 'typo-tolerant'].filter(Boolean).join(', ');
  }
</script>

{#if query}
  <InfoBox {margin}>
    <ul>
      {#each query.blocks as block}
        <li>
          {#if block.negate}<span class="font-bold">not</span>{/if}
          <span class="font-bold">
            {block.fields.length === FIELDS.length ? 'any field' : block.fields.join(', ')}:
          </span>
          {block.text}
          {#if how(block)}<span class="italic">({how(block)})</span>{/if}
        </li>
      {/each}
      {#each query.paths as path}
        <li>
          {#if path.negate}<span class="font-bold">not</span>{/if}
          <span class="font-bold">path:</span>
          {path.value}
        </li>
      {/each}
    </ul>
  </InfoBox>
{/if}
