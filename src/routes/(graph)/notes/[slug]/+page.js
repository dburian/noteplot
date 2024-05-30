import { error } from '@sveltejs/kit';

export async function load({ params }) {
  try {
    const note = (await import(`$lib/notes/${params.slug}.json`)).default

    return {
      note,
      withGraph: false,
    }
  } catch {
    return error(404, {message: `Note ${params.slug} not found.`})
  }

}


export async function entries() {
  const readdir = (await import('fs/promises')).readdir;
  const noteJsons = await readdir('src/lib/notes')

  return noteJsons.filter(jsonName => !jsonName.startsWith("__")).map(jsonName => { return { slug: jsonName.replace(".json", "") } });
}

