<script>
    import SearchWindow from "$lib/search/SearchWindow.svelte";

  export let data;

</script>

<SearchWindow notes={data.searchNotes} />
