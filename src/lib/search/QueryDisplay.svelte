<script>
    import InfoBox from '$lib/components/InfoBox.svelte';


  /** @type {import('minisearch').Query} */
  export let query;
</script>

{#if query}
  <InfoBox>
    {#if typeof query == 'string'}
      {query}
    {:else}
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
            <svelte:self query={subQuery} />
          </li>
        {/each}
        </ul>
      </div>
    {/if}
  </InfoBox>
{/if}
