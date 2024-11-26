<script>
    import FilterWindow from "$lib/search/FilterWindow.svelte";

  export let data;

</script>

<FilterWindow notes={data.searchNotes} />
