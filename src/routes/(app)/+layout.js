// Dynamic import, not a static one: Vite inlines statically imported JSON into
// the bundle, and __graph.json is the whole graph (ISSUES.md B2). `load` runs at
// build time for the prerender and in the browser on navigation, so both still
// get the data — the browser just fetches it as its own chunk.
export async function load() {
  const graph = await import('$lib/notes/__graph.json');

  return { ...graph.default };
}

export const prerender = true;
