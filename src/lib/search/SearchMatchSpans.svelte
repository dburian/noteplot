<script>
  export let spans;
</script>

{#each spans as span}
  <span class="mr-4">
    {span.before}<span class="bg-yellow-200">{span.match}</span>{span.after}
  </span>
{/each}
