<script>
    import NoteContent from '$lib/note/NoteContent.svelte';

  export let data;
</script>

<NoteContent {...data.note} />

