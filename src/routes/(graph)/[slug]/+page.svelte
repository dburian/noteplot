<script>
  import Note from "$lib/Note.svelte";

  export let data;
</script>

<Note {...data.note} />

