import searchNotes from "$lib/notes/__search.json";

export function load() {


  return {
    withGraph: true,
    search: '',
    searchNotes,
  }
}
