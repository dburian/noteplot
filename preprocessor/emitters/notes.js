import { logger } from '../log.js';

/** @type {import('../types.js').Field[]} */
const DEPS = [
  'title',
  'matter',
  'readingTime',
  'linkSlugs',
  'html',
  'backlinks',
  'path',
  'noteRoot',
  'originalPath'
];

/**
 * `notes/<slug>.json`: one per note, the page the frontend renders.
 *
 * A note's JSON embeds `{slug, title}` for each of its links and backlinks, so
 * an edit can invalidate files whose notes did not change -- the targets a link
 * was removed from, the sources of a deleted note, and, when a title changes,
 * both sides of every edge. The corpus reports those as `changed` (`backlinks`)
 * and `neighbours`; this rewrites all of them (ISSUES.md A6, A20).
 *
 * A change to `text` alone needs no rewrite -- the plaintext is not in here --
 * which is why `deps` lists fields rather than `'*'`.
 *
 * @type {import('../types.js').Emitter}
 */
export const notesEmitter = {
  id: 'notes',
  deps: DEPS,

  async emit(corpus, changes, { writer }) {
    /** @param {string} slug */
    const rel = (slug) => `notes/${slug}.json`;

    const toWrite = changes.cold
      ? new Set(corpus.records.keys())
      : new Set([
          ...changes.added,
          ...changes.neighbours,
          ...[...changes.changed]
            .filter(([, fields]) => DEPS.some((dep) => fields.has(dep)))
            .map(([slug]) => slug)
        ]);

    await Promise.all([
      ...[...changes.removed].map((slug) => writer.remove(rel(slug))),
      ...[...toWrite].map((slug) => {
        const record = /** @type {import('../types.js').NoteRecord} */ (corpus.records.get(slug));
        return writer.write(rel(slug), toNoteJson(record, corpus));
      })
    ]);
  }
};

/**
 * The shape `$lib/notes_route.js`'s `Note` typedef describes. Keep the two in
 * step by hand.
 *
 * @param {import('../types.js').NoteRecord} record
 * @param {import('../corpus.js').Corpus} corpus
 */
function toNoteJson(record, corpus) {
  return {
    slug: record.slug,
    title: record.title,
    html: record.html,
    links: resolveLinks(record.linkSlugs, record.slug, corpus),
    backlinks: resolveLinks(corpus.backlinksOf(record.slug), record.slug, corpus),
    matter: record.matter,
    readingTime: record.readingTime,
    path: record.path,
    noteRoot: record.noteRoot,
    originalPath: record.originalPath
  };
}

/**
 * @param {Iterable<string>} slugs
 * @param {string} from
 * @param {import('../corpus.js').Corpus} corpus
 */
function resolveLinks(slugs, from, corpus) {
  const links = [];
  for (const slug of slugs) {
    const target = corpus.records.get(slug);
    if (!target) logger.warn(`Link to unknown note: ${slug} from note ${from}.`);
    links.push({ slug, title: target?.title ?? 'Unknown' });
  }
  return links;
}
