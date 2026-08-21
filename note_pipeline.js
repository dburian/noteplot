import path from 'path';
import { readSync } from 'to-vfile';
import { createRehypePipeline, logger, toSlug } from './unify_pipelines.js';
import reporter from 'vfile-reporter';
import { saveJSON } from './note_preprocessor.js';
import { mkdir, readdir, rm } from 'fs/promises';

export class NotePipeline {
  constructor(config) {
    this.config = config;
    this.backlinks = new Map();
    // An image's destination in `static/note_imgs/` is derived from the image's
    // own path, so two notes embedding the same file share one copy of it. Who
    // still refers to each copy, so it is removed only when the last one drops
    // it (ISSUES.md A19).
    /** @type {Map<string, Set<string>>} destPath -> slugs referring to it */
    this.imageRefs = new Map();
    this.rehypePipeline = createRehypePipeline({
      ...this.config,
      backlinks: this.backlinks
    });

    this.notes = new Map();
  }

  async _setupPaths() {
    await Promise.all([
      mkdir(this.config.savePath, { recursive: true }),
      mkdir(this.config.imgSavePath, { recursive: true })
    ]);
  }

  async on(events, previousResult) {
    await this._setupPaths();

    const toDelete = [];
    const addPromises = [];
    const changePromises = [];
    for (const { eventType, targetPath } of events) {
      if (eventType == 'add') {
        addPromises.push(this.add(targetPath));
      } else if (eventType == 'change') {
        changePromises.push(this.change(targetPath));
      } else {
        toDelete.push(targetPath);
      }
    }

    // Neighbours whose own JSON has to be rewritten even though their file did
    // not change: their `links`/`backlinks` embed a slug and a title that has
    // just moved underneath them (ISSUES.md A6, A20). Kept out of `diffs`,
    // which means "what changed inside this note" to `GraphPipeline` -- a
    // `links` entry there would send the node down the re-layout path.
    const resave = new Set();

    const diffs = new Map();
    const toSave = await Promise.all(addPromises);
    for (const slug of toSave) {
      // Notes that already link here resolved to the `Unknown` placeholder
      // while this one did not exist. Now they resolve to a real title.
      for (const source of this.backlinks.get(slug) ?? []) resave.add(source);
    }

    for (const { slug, changeSets, resave: changeResave } of await Promise.all(changePromises)) {
      toSave.push(slug);

      for (const neighbour of changeResave) resave.add(neighbour);

      for (const [changedSlug, diff] of changeSets.entries()) {
        const oldDiff = diffs.get(changedSlug) || new Set();
        diffs.set(changedSlug, diff.union(oldDiff));
      }
    }

    // Deletes run before the saves, not alongside them: `_deleteNote` prunes
    // the `backlinks` map and drops the note from `this.notes`, and the save
    // loop has to see both -- otherwise a neighbour is rewritten carrying a
    // backlink to a note that is on its way out.
    const deletePromises = [];
    for (const notePath of toDelete) {
      const slug = toSlug(notePath, this.config.noteRoot);
      const note = this.notes.get(slug);
      if (typeof note === 'undefined') {
        logger.debug(`Nothing known about ${slug}. Nothing to delete.`);
        continue;
      }

      deletePromises.push(this._deleteNote(note));
    }

    // Awaited before the save loop, and separately from it, for the ordering
    // above. A failed delete rejects `on()` rather than escaping as an
    // unhandled rejection (the A9 failure mode).
    for (const affected of await Promise.all(deletePromises)) {
      for (const slug of affected) resave.add(slug);
    }

    const writePromises = [];

    // `toSlug` is injective and `_coalesceEvents` emits one event per path, so
    // a slug appears at most once in `toSave`. The Set is here for the overlap
    // between it and the neighbours in `diffs`/`resave`, which is ordinary
    // rather than a guard -- a note is often both edited and a neighbour of
    // another edit.
    for (const slug of new Set([...toSave, ...diffs.keys(), ...resave])) {
      const note = this.notes.get(slug);
      // A neighbour that was itself deleted in this same batch.
      if (typeof note === 'undefined') continue;

      this._enrichNote(note);
      writePromises.push(this._saveNote(note));
    }

    // Awaited so that the pipeline does not resolve before its writes land, and
    // so that a failed write rejects `on()` instead of becoming an unhandled
    // rejection that takes the process down.
    await Promise.all(writePromises);

    return { ...previousResult, notes: this.notes, changes: diffs };
  }

  async add(targetPath) {
    const note = await this._rehype(targetPath);

    // An `add` for a slug we already hold is reachable through `change()`'s
    // never-seen-slug fallback, and the images that version embedded have to be
    // released or the map keeps them alive for ever.
    const oldNote = this.notes.get(note.slug);
    await this._updateImageRefs(
      note.slug,
      oldNote ? this._imagesOf(oldNote) : [],
      this._imagesOf(note)
    );

    this.notes.set(note.slug, note);

    return note.slug;
  }

  async change(targetPath) {
    const note = await this._rehype(targetPath);

    const changeSets = new Map();
    const oldNote = this.notes.get(note.slug);
    this.notes.set(note.slug, note);

    if (typeof oldNote === 'undefined') {
      // A change for a note we have never seen -- there is nothing to diff
      // against, so report everything as changed and let the downstream
      // pipelines treat it as an add.
      logger.debug(`Nothing known about ${note.slug}. Treating the change as an add.`);
      changeSets.set(note.slug, new Set(['links', 'images', 'title', 'content', 'matter']));
      // Treated as an add down to the neighbours: anything already linking here
      // was resolving to the `Unknown` placeholder.
      return {
        slug: note.slug,
        changeSets,
        resave: new Set(this.backlinks.get(note.slug) ?? [])
      };
    }

    const diffKeys = new Set();
    // Neighbours to rewrite because of this change. See `on()`.
    const resave = new Set();

    const oldSlugs = new Set(this._linkSlugsOf(oldNote));
    const newSlugs = new Set(this._linkSlugsOf(note));

    const linksXor = oldSlugs.union(newSlugs).difference(oldSlugs.intersection(newSlugs));
    if (linksXor.size > 0) {
      diffKeys.add('links');

      for (const slug of linksXor) {
        if (changeSets.has(slug)) changeSets.get(slug).add('backlinks');
        else changeSets.set(slug, new Set(['backlinks']));
      }

      // `addLinks` only ever adds, so a link this version dropped would leave a
      // backlink on its target forever (ISSUES.md A6). `_rehype` ran above, so
      // the new links are already in the map and old-minus-new is exactly the
      // set that no longer has anything justifying it.
      for (const slug of oldSlugs.difference(newSlugs)) {
        this.backlinks.get(slug)?.delete(note.slug);
      }
    }

    if (!isDeepEqual(oldNote.images, note.images)) {
      diffKeys.add('images');
    }

    for (const key of ['title', 'content', 'matter']) {
      if (!isDeepEqual(oldNote[key], note[key])) {
        diffKeys.add(key);
      }
    }

    // Awaited, so a failed removal rejects `change()` instead of escaping as an
    // unhandled rejection.
    await this._updateImageRefs(note.slug, this._imagesOf(oldNote), this._imagesOf(note));

    // Both sides of every edge cache this note's title -- its sources in their
    // `links`, its targets in their `backlinks` -- so a renamed heading goes
    // stale in every neighbour's JSON (ISSUES.md A20).
    if (diffKeys.has('title')) {
      for (const source of this.backlinks.get(note.slug) ?? []) resave.add(source);
      for (const target of newSlugs) resave.add(target);
    }

    changeSets.set(note.slug, diffKeys);
    return {
      slug: note.slug,
      changeSets,
      resave
    };
  }

  /**
   * The slugs `note` links to, from whichever shape it currently carries.
   *
   * A note that has been through `on()`'s save loop carries enriched `links`
   * and no `linkSlugs`; one that has only been parsed carries `linkSlugs`; one
   * whose flush failed part-way can carry neither.
   *
   * @param {{links?: {slug: string}[], linkSlugs?: string[]}} note
   * @returns {string[]}
   */
  _linkSlugsOf(note) {
    return note.links?.map((l) => l.slug) ?? note.linkSlugs ?? [];
  }

  /**
   * The images `note` has copied into `imgSavePath`, tolerating a note that
   * never got as far as `collectImgs`.
   *
   * Same tolerance as `_linkSlugsOf` above, and needed in the same place: a
   * note whose first parse threw part-way is still in `this.notes` and can
   * still be deleted.
   *
   * @param {{images?: string[]}} note
   * @returns {string[]}
   */
  _imagesOf(note) {
    return note.images ?? [];
  }

  /**
   * Move `slug`'s image references from `oldImages` to `newImages`.
   *
   * Only the images this version dropped are released. Releasing the whole old
   * set and re-referencing the new one would not do: references are keyed by
   * slug, so an image the note kept would be added and immediately removed
   * again, and a note that is its only referrer would delete the file
   * `_rehype` has just rewritten.
   *
   * @param {string} slug
   * @param {string[]} oldImages
   * @param {string[]} newImages
   */
  async _updateImageRefs(slug, oldImages, newImages) {
    const kept = new Set(newImages);
    this._refImages(slug, newImages);
    await this._derefImages(
      slug,
      oldImages.filter((imgPath) => !kept.has(imgPath))
    );
  }

  /**
   * Record that `slug` refers to each of `images`.
   *
   * @param {string} slug
   * @param {string[]} images destination paths under `imgSavePath`
   */
  _refImages(slug, images) {
    for (const imgPath of images) {
      let refs = this.imageRefs.get(imgPath);
      if (!refs) {
        refs = new Set();
        this.imageRefs.set(imgPath, refs);
      }
      refs.add(slug);
    }
  }

  /**
   * Drop `slug`'s claim on each of `images`, removing the file once nothing
   * refers to it any more.
   *
   * This is the whole of the A19 fix: an image's destination is derived from
   * the image's own path, so two notes embedding the same file get one copy
   * between them, and the note that stops referring to it first used to delete
   * the file the other one still points at.
   *
   * `force`, still, because the file may genuinely be gone -- the user can
   * delete it by hand, and an ENOENT here would reject the whole batch.
   *
   * @param {string} slug
   * @param {string[]} images destination paths under `imgSavePath`
   */
  async _derefImages(slug, images) {
    const removePromises = [];

    for (const imgPath of images) {
      const refs = this.imageRefs.get(imgPath);
      if (!refs) continue;

      refs.delete(slug);
      if (refs.size > 0) continue;

      this.imageRefs.delete(imgPath);
      logger.debug(`Removing ${imgPath}`);
      removePromises.push(rm(imgPath, { force: true }));
    }

    await Promise.all(removePromises);
  }

  /**
   * Removes everything in `imgSavePath` that no note refers to.
   *
   * Reference counting keeps the directory correct within a session, but
   * nothing has ever pruned it across one: an image dropped while the
   * preprocessor was not running stays for ever. `NotesUpdater.updateAll`
   * calls this once the startup scan has populated `imageRefs`, and only when
   * that scan succeeded -- after a failed batch the map is incomplete and this
   * would delete images that are still in use.
   */
  async pruneOrphanImages() {
    let entries;
    try {
      entries = await readdir(this.config.imgSavePath, { withFileTypes: true });
    } catch (error) {
      logger.warn(`Could not read ${this.config.imgSavePath}: ${error.message}`);
      return;
    }

    const removePromises = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const imgPath = path.join(this.config.imgSavePath, entry.name);
      if (this.imageRefs.has(imgPath)) continue;

      logger.info(`Removing orphaned image ${imgPath}.`);
      removePromises.push(rm(imgPath, { force: true }));
    }

    await Promise.all(removePromises);
  }

  /**
   * Resolve `note`'s link and backlink slugs into `{slug, title}` pairs.
   *
   * Idempotent, unlike the inline version this replaced: a neighbour re-saved
   * because someone else's edit moved its backlinks has already been enriched
   * once and must survive being enriched again. Same tolerance as `change()`
   * (the A10 fix).
   */
  _enrichNote(note) {
    note.links = this._enrichLinks(this._linkSlugsOf(note), note.slug);
    delete note.linkSlugs;

    note.backlinks = this._enrichLinks(this.backlinks.get(note.slug) ?? [], note.slug);
  }

  _enrichLinks(linkSlugs, noteSlug) {
    const links = [];
    for (const slug of linkSlugs) {
      let target = this.notes.get(slug);
      if (typeof target === 'undefined') {
        logger.warn(`Link to unknown note: ${slug} from note ${noteSlug}.`);
        target = {
          title: 'Unknown'
        };
      }

      links.push({
        slug,
        title: target.title
      });
    }

    return links;
  }

  notePath(note) {
    return path.join(this.config.savePath, `${note.slug}.json`);
  }

  async _saveNote(note) {
    const noteSavePath = this.notePath(note);
    await saveJSON(noteSavePath, note);
  }

  async _deleteNote(note) {
    // Neighbours on both sides hold a copy of this note that is about to be
    // wrong: its sources keep a link that no longer resolves, its targets keep
    // a backlink from a note that is gone. Returned so `on()` rewrites them.
    const affected = new Set(this.backlinks.get(note.slug) ?? []);

    // Remove backlinks created by `note`
    for (const slug of this._linkSlugsOf(note)) {
      this.backlinks.get(slug)?.delete(note.slug);
      affected.add(slug);
    }

    // Delete note itself, and release its images -- the copies still referred to
    // by another note stay where they are.
    await Promise.all([
      rm(this.notePath(note), { force: true }),
      this._derefImages(note.slug, this._imagesOf(note))
    ]);

    // Delete record of the note. `this.backlinks.get(note.slug)` is deliberately
    // kept: it describes links that still exist in other notes, so it is
    // correct again the moment this note comes back.
    this.notes.delete(note.slug);

    return affected;
  }

  async _rehype(targetPath) {
    const file = await this.rehypePipeline.process(readSync(targetPath));
    const report = reporter(file, { silent: true });
    if (report) logger.error(report);

    const note = { ...file.data };
    note.content = file.value;

    return note;
  }
}

export function isDeepEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length != b.length) return false;

    // A plain loop, not `new Array(a.length).every(...)`: that array is sparse,
    // `.every` skips holes, so the callback never ran and any two arrays of the
    // same length compared equal.
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }

    return true;
  }

  // `typeof null == 'object'`, so this has to come before the object branch --
  // `Object.getOwnPropertyNames(null)` throws. A frontmatter key with an empty
  // value (`key:`) parses to `null`, so it is reachable from a note.
  if (a === null || b === null) return a === b;

  if (typeof a == 'object' || typeof b == 'object') {
    if (typeof a != 'object' || typeof b != 'object') return false;

    const aKeys = Object.getOwnPropertyNames(a);
    const bKeys = Object.getOwnPropertyNames(b);

    if (!isDeepEqual(aKeys, bKeys)) {
      return false;
    }

    for (const k of aKeys) {
      if (!isDeepEqual(a[k], b[k])) {
        return false;
      }
    }

    return true;
  }

  return a == b;
}
