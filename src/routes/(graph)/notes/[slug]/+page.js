import { loadNote, noteEntries } from '$lib/notes_route.js';

// No flag says "show this one without the graph" -- the pathname does. See
// `WithContentState.svelte`, which derives `onlyContent` from it.
export async function load({ params }) {
  return {
    note: await loadNote(params.slug)
  };
}

export const entries = noteEntries;
