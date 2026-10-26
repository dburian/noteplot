/**
 * The preprocessor's contracts. Types only; nothing here runs.
 *
 * The data flow is:
 *
 *   scan/watch ─▶ parse ─▶ NoteRecord ─▶ Corpus.apply ─▶ ChangeSet ─▶ Emitter[]
 *
 * A **NoteRecord** is everything one Markdown file produces on its own. It is a
 * pure function of the file's bytes, its path and the preprocessor config, which
 * is what makes it cacheable and parseable in a worker thread. Anything that
 * needs another note -- backlinks, a link's title -- is not in it.
 *
 * @typedef {{
 *   slug: string,
 *   path: string,
 *   noteRoot: string,
 *   originalPath: string,
 *   title: string,
 *   matter: Record<string, any>,
 *   created: number | null,
 *   mtimeMs?: number,
 *   readingTime: {text: string, minutes: number, time: number, words: number},
 *   linkSlugs: string[],
 *   images: NoteImage[],
 *   html: string,
 *   text: string,
 * }} NoteRecord
 *
 * `path` is relative to the note root with `/` separators; `originalPath` is
 * absolute and kept on purpose -- locally it is useful to see where a note lives.
 * `html` is the rendered body, `text` the stripped plaintext the search index
 * and any content-derived graph read.
 *
 * `created` is the frontmatter's `created` date, as ms at UTC midnight, or
 * `null` when it is missing or malformed (the parse warns). `mtimeMs` is the
 * **one exception** to "a pure function of the bytes": `NoteParser` attaches the
 * file's mtime after the cache lookup, never stores it, and only on records
 * whose `created` is `null` -- it is the date graph's fallback.
 *
 * @typedef {{src: string, dest: string}} NoteImage
 * `src` is the image's absolute path, `dest` its file name in `static/note_imgs/`.
 * The name is derived from the image's own path, so two notes embedding one
 * file share one copy.
 *
 * @typedef {keyof NoteRecord | 'backlinks'} Field
 *
 * A **ChangeSet** is what one batch did to the corpus, computed once, so no
 * emitter has to re-derive it from watcher events.
 *
 * @typedef {{
 *   cold: boolean,
 *   added: Set<string>,
 *   removed: Set<string>,
 *   changed: Map<string, Set<Field>>,
 *   neighbours: Set<string>,
 *   previous: Map<string, NoteRecord>,
 * }} ChangeSet
 *
 * - `cold` -- the startup scan. Every emitter runs, whatever else is in here.
 * - `changed` -- notes that existed before and after, and which of their fields
 *   differ. `backlinks` is derived: it lands on a link's target when the link
 *   appears or disappears.
 * - `neighbours` -- notes whose own fields did not change but whose rendering
 *   embeds something about another note that did: a linked note was renamed,
 *   appeared, or went away. The per-note JSON is the only consumer today.
 * - `previous` -- the old record of every changed or removed note.
 *
 * An **Emitter** turns the corpus into output files. It runs when the batch is
 * cold, when a note was added or removed, or when a changed field is in `deps`.
 * Emitters only read the corpus, so they run concurrently; one that keeps state
 * across batches keeps it in its own closure.
 *
 * @typedef {{
 *   id: string,
 *   deps: Field[] | '*',
 *   emit: (corpus: import('./corpus.js').Corpus, changes: ChangeSet, ctx: EmitContext) => Promise<void>,
 *   afterColdScan?: (corpus: import('./corpus.js').Corpus, ctx: EmitContext) => Promise<void>,
 * }} Emitter
 *
 * `afterColdScan` runs once, after a startup scan in which every note parsed;
 * it is where an emitter may delete what the corpus no longer accounts for.
 *
 * @typedef {{
 *   writer: import('./writer.js').ArtifactWriter,
 *   cache: import('./cache.js').Cache,
 *   config: PreprocessConfig,
 * }} EmitContext
 *
 * @typedef {{
 *   noteRoot: string,
 *   savePath: string,
 *   imgSavePath: string,
 *   imgUrl: string,
 *   cachePath: string,
 *   watch?: boolean,
 *   watchDebounce?: number,
 * }} PreprocessConfig
 */

export {};
