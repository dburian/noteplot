<script>
  import NoteContent from '$lib/note/NoteContent.svelte';

  export let data;
</script>

<NoteContent note={data.note} />
