// Dynamic import, not a static one: Vite inlines statically imported JSON into
// the bundle (ISSUES.md B2). `load` runs at build time for the prerender and in
// the browser on navigation, so both still get the data -- the browser just
// fetches it as its own chunk.
//
// Only the note index -- slug, title, path, matter. Each visualization loads
// its own data file, so the graph is no longer fetched by every page.
export async function load() {
  const index = await import('$lib/generated/index.json');

  return { notes: index.default };
}

export const prerender = true;
