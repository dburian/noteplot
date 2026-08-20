import { loadNote, noteEntries } from '$lib/notes_route.js';

export async function load({ params }) {
  return {
    note: await loadNote(params.slug)
  };
}

export const entries = noteEntries;
