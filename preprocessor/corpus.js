import { isDeepEqual } from './util.js';

/**
 * Every field of a record that can differ between two parses of one note. All
 * of them, so an emitter can depend on any one and be told when it moves.
 *
 * @type {(keyof import('./types.js').NoteRecord)[]}
 */
const DIFFED_FIELDS = [
  'title',
  'matter',
  'readingTime',
  'linkSlugs',
  'images',
  'html',
  'text',
  'path',
  'noteRoot',
  'originalPath'
];

/**
 * The single owner of what is known about the collection: one record per note,
 * plus the indexes that need more than one note to compute.
 *
 * `apply` is the only mutation, and it reports what it did as a `ChangeSet`, so
 * no emitter has to work out for itself what a batch of watcher events meant.
 */
export class Corpus {
  constructor() {
    /** @type {Map<string, import('./types.js').NoteRecord>} */
    this.records = new Map();
    /**
     * target slug → slugs of the notes linking to it. Derived from every
     * record's `linkSlugs`. A target need not exist: an entry for a missing
     * note describes links that are still there, and is correct again the
     * moment the note appears.
     *
     * @type {Map<string, Set<string>>}
     */
    this.backlinks = new Map();
  }

  /** @param {string} slug */
  backlinksOf(slug) {
    return this.backlinks.get(slug) ?? new Set();
  }

  /**
   * @param {{upserts: import('./types.js').NoteRecord[], removals: string[], cold?: boolean}} batch
   * @returns {import('./types.js').ChangeSet}
   */
  apply({ upserts, removals, cold = false }) {
    /** @type {import('./types.js').ChangeSet} */
    const changes = {
      cold,
      added: new Set(),
      removed: new Set(),
      changed: new Map(),
      neighbours: new Set(),
      previous: new Map()
    };

    /** @param {string} slug @param {import('./types.js').Field} field */
    const mark = (slug, field) => {
      let fields = changes.changed.get(slug);
      if (!fields) changes.changed.set(slug, (fields = new Set()));
      fields.add(field);
    };

    for (const slug of removals) {
      const old = this.records.get(slug);
      if (!old) continue;

      this.records.delete(slug);
      changes.removed.add(slug);
      changes.previous.set(slug, old);

      // Its targets lose a backlink; its sources keep a link that no longer
      // resolves to a title.
      for (const target of old.linkSlugs) {
        this.backlinks.get(target)?.delete(slug);
        mark(target, 'backlinks');
      }
      for (const source of this.backlinksOf(slug)) changes.neighbours.add(source);
    }

    // Sorted, so a cold start inserts in the same order however the parse
    // finished; `records` iterates in insertion order.
    const sorted = [...upserts].sort((a, b) => (a.slug < b.slug ? -1 : 1));
    for (const record of sorted) {
      const old = this.records.get(record.slug);
      this.records.set(record.slug, record);

      if (!old) {
        changes.added.add(record.slug);
        for (const target of record.linkSlugs) {
          this._link(record.slug, target);
          mark(target, 'backlinks');
        }
        // Notes already linking here resolved to the `Unknown` placeholder
        // while this one did not exist.
        for (const source of this.backlinksOf(record.slug)) changes.neighbours.add(source);
        continue;
      }

      const fields = new Set(DIFFED_FIELDS.filter((key) => !isDeepEqual(old[key], record[key])));
      if (fields.size == 0) continue;

      changes.previous.set(record.slug, old);
      for (const field of fields) mark(record.slug, field);

      if (fields.has('linkSlugs')) {
        const before = new Set(old.linkSlugs);
        const after = new Set(record.linkSlugs);
        for (const target of after.difference(before)) {
          this._link(record.slug, target);
          mark(target, 'backlinks');
        }
        // Without this a link the note dropped would leave a backlink on its
        // target for ever (ISSUES.md A6).
        for (const target of before.difference(after)) {
          this.backlinks.get(target)?.delete(record.slug);
          mark(target, 'backlinks');
        }
      }

      // Both sides of every edge show this note's title -- its sources in
      // their links, its targets in their backlinks (ISSUES.md A20).
      if (fields.has('title')) {
        for (const source of this.backlinksOf(record.slug)) changes.neighbours.add(source);
        for (const target of record.linkSlugs) changes.neighbours.add(target);
      }
    }

    // A neighbour, or a link target, that is not a note: a dead link, or a note
    // removed in this same batch. And an added note is reported as added only.
    for (const slug of changes.changed.keys()) {
      if (!this.records.has(slug) || changes.added.has(slug)) changes.changed.delete(slug);
    }
    for (const slug of changes.neighbours) {
      if (!this.records.has(slug) || changes.added.has(slug)) changes.neighbours.delete(slug);
    }

    return changes;
  }

  /** @param {string} source @param {string} target */
  _link(source, target) {
    let sources = this.backlinks.get(target);
    if (!sources) this.backlinks.set(target, (sources = new Set()));
    sources.add(source);
  }
}

/**
 * Whether `emitter` has anything to do for `changes`.
 *
 * @param {import('./types.js').Emitter} emitter
 * @param {import('./types.js').ChangeSet} changes
 */
export function isAffected(emitter, changes) {
  if (changes.cold || changes.added.size > 0 || changes.removed.size > 0) return true;
  if (emitter.deps == '*') return changes.changed.size > 0 || changes.neighbours.size > 0;

  for (const fields of changes.changed.values()) {
    for (const dep of emitter.deps) if (fields.has(dep)) return true;
  }
  return false;
}
