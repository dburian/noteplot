import path from 'path';
import { readSync } from "to-vfile"
import { createRehypePipeline, logger, toSlug } from "./unify_pipelines.js"
import reporter from "vfile-reporter"
import { saveJSON } from './note_preprocessor.js';
import { rm } from 'fs/promises';

export class NotePipeline {
  constructor(config) {
    this.config = config
    this.backlinks = new Map()
    this.rehypePipeline = createRehypePipeline({
      ...this.config,
      backlinks: this.backlinks
    })

    this.notes = new Map()
  }

  async on(events, previousResult) {
    const toDelete = []
    const addPromises = []
    const changePromises = []
    for (const { eventType, targetPath } of events) {
      if (eventType == 'add') {
        addPromises.push(this.add(targetPath))
      } else if (eventType == 'change') {
        changePromises.push(this.change(targetPath))
      } else {
        toDelete.push(targetPath)
      }
    }

    const diffs = new Map()
    const toSave = await Promise.all(addPromises)
    for (const { slug, changeSets } of await Promise.all(changePromises)) {
      toSave.push(slug)

      for (const [slug, diff] of changeSets.entries()) {
        const oldDiff = diffs.get(slug) || new Set()
        diffs.set(slug, diff.union(oldDiff))
      }
    }

    for (const slug of toSave) {
      const note = this.notes.get(slug)

      note.links = this._enrichLinks(note.linkSlugs, note.slug)
      delete note.linkSlugs

      const slugBacklinks = this.backlinks.get(note.slug) || []
      note.backlinks = this._enrichLinks(slugBacklinks, note.slug)

      this._saveNote(this.notes.get(slug))
    }

    for (const notePath of toDelete) {
      const slug = toSlug(notePath, this.config.noteRoot)
      this._deleteNote(this.notes.get(slug))
    }

    return { ...previousResult, notes: this.notes, changes: diffs }
  }

  async add(targetPath) {
    const note = await this._rehype(targetPath)
    this.notes.set(note.slug, note)

    return note.slug
  }


  async change(targetPath) {
    const note = await this._rehype(targetPath)

    const changeSets = new Map()
    const oldNote = this.notes.get(note.slug)
    this.notes.set(note.slug, note)

    const diffKeys = new Set()
    const oldSlugs = new Set(oldNote['links'].map(l => l.slug))
    const newSlugs = new Set(note['linkSlugs'])

    const linksXor = oldSlugs.union(newSlugs).difference(oldSlugs.intersection(newSlugs))
    if (linksXor.size > 0) {
      diffKeys.add('links')

      for (const slug of linksXor) {
        if (changeSets.has(slug)) changeSets.get(slug).add('backlinks')
        else changeSets.set(slug, new Set(['backlinks']))
      }
    }

    const removePromises = []
    if (!isDeepEqual(oldNote.images, note.images)) {
      console.log(JSON.stringify(oldNote.images), JSON.stringify(note.images))
      const oldImages = oldNote.images.filter(imgPath => !note.images.includes(imgPath))
      for (const imgPath of oldImages) {
        logger.debug(`Removing ${imgPath}`)
        removePromises.push(rm(imgPath))
      }

      diffKeys.add('images')
    }

    for (const key of ['title', 'content', 'matter']) {
      if (!isDeepEqual(oldNote[key], note[key])) {
        diffKeys.add(key)
      }
    }

    changeSets.set(note.slug, diffKeys)
    return {
      slug: note.slug,
      changeSets,
    }
  }

  _enrichLinks(linkSlugs, noteSlug) {
    const links = []
    for (const slug of linkSlugs) {
      let target = this.notes.get(slug)
      if (typeof target === "undefined") {
        logger.warn(`Link to unknown note: ${slug} from note ${noteSlug}.`)
        target = {
          title: 'Unknown',
        }
      }

      links.push({
        slug,
        title: target.title
      })
    }

    return links
  }

  notePath(note) {
    return path.join(this.config.savePath, `${note.slug}.json`)
  }


  async _saveNote(note) {
    const noteSavePath = this.notePath(note)
    await saveJSON(noteSavePath, note)
  }

  async _deleteNote(note) {
    // Remove backlinks created by `note`
    for (const link of note.links) {
      this.backlinks[link.slug].remove(note.slug)
    }

    const deletePromises = []

    // Delete note itself
    const noteSavePath = this.notePath(note)
    deletePromises.push(rm(noteSavePath))

    // Delete images
    for (const imgPath of note.images) {
      deletePromises.push(rm(imgPath))
    }

    await Promise.all(deletePromises)

    // Delete record of the note
    this.notes.delete(note.slug)
  }

  async _rehype(targetPath) {
    const file = await this.rehypePipeline.process(readSync(targetPath))
    const report = reporter(file, { silent: true })
    if (report) logger.error(report)

    const note = { ...file.data };
    note.content = file.value

    return note
  }

}

export function isDeepEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length != b.length) return false

    return (new Array(a.length)).every((_, i) => isDeepEqual(a[i], b[i]))
  }

  if (typeof a == 'object' || typeof b == 'object') {
    if (typeof a != 'object' || typeof b != 'object') return false

    const aKeys = Object.getOwnPropertyNames(a)
    const bKeys = Object.getOwnPropertyNames(b)

    if (!isDeepEqual(aKeys, bKeys)) {
      return false
    }

    for (const k of aKeys) {
      if (!isDeepEqual(a[k], b[k])) {
        return false
      }
    }

    return true
  }

  return a == b
}
