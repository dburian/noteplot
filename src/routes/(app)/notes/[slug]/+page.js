import { loadNote, noteEntries } from '$lib/notes_route.js';

// No flag says "show this one without the visualization" -- the pathname does.
// `readUrlState` in `$lib/state/url_state.js` seeds `layout: 'content'` for any
// path under `${base}/notes/`. It only *seeds* it: an explicit `?layout=` wins,
// and cycling the layout from here writes one.
export async function load({ params }) {
  return {
    note: await loadNote(params.slug)
  };
}

export const entries = noteEntries;
