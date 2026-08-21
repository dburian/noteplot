<script>
  import InfoBox from '$lib/components/InfoBox.svelte';

  /**
   * What `parseSearchString` made of what you typed — which fields it will look
   * in, and how the terms combine.
   *
   * In the overlays this is behind the toolbar's **Metadata** toggle, the same
   * switch that shows a note's frontmatter and backlinks: both answer "show me
   * the machinery", and neither is something you want in the way by default.
   *
   * @type {import('minisearch').Query}
   */
  export let query;

  /** Passed through to `InfoBox`; the overlays want `mb-0`. @type {string} */
  export let margin = 'mb-10';
</script>

{#if query}
  <InfoBox {margin}>
    {#if typeof query == 'string'}
      {query}
      <!-- `Query` also admits minisearch's wildcard symbol, which has nothing to show. -->
    {:else if typeof query == 'object'}
      <div>
        {#if query.fields !== undefined}
          <p>
            <span class="font-bold">fields:</span>
            {query.fields.join(', ')}
          </p>
        {/if}
        {#if query.combineWith !== undefined}
          <p>
            <span class="font-bold">combine:</span>
            {query.combineWith}
          </p>
        {/if}
        <span class="font-bold">queries:</span>
        <ul>
          {#each query.queries as subQuery}
            <li>
              <svelte:self query={subQuery} {margin} />
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </InfoBox>
{/if}
