// Dynamic import so the full plaintext of every note ships only to visitors who
// open search or filter, instead of being inlined into the bundle (ISSUES.md B2).
export async function load() {
  const searchNotes = await import('$lib/notes/__search.json');

  return {
    searchNotes: searchNotes.default
  };
}
