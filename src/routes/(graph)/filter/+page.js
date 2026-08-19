// Dynamic import, for the same reason as in `search/+page.js` (ISSUES.md B2).
export async function load() {
  const searchNotes = await import('$lib/notes/__search.json');

  return {
    searchNotes: searchNotes.default
  };
}
