import { readSync } from "to-vfile"
import { createRetextPipeline, logger, toSlug } from "./unify_pipelines.js"
import { saveJSON } from "./note_preprocessor.js"
import path from 'path';

export class SearchIndexPipeline {
  constructor(config) {
    this.config = config

    this.retextPipepline = createRetextPipeline({ noteRoot: config.noteRoot })

    this.index = new Map()
  }

  async on(events, previousResults) {
    const indexPromises = []
    for (const { eventType, targetPath } of events) {
      if (eventType === 'add' || eventType === 'change') {
        //'content' is changed almost always, therefore, re-indexing makes
        //sense
        indexPromises.push(this.indexNote(targetPath))
      } else if (eventType == 'unlink') {
        const slug = toSlug(targetPath)
        this.unindexNote(slug)
      }
    }
    await Promise.all(indexPromises)

    // We can rebuild the index as a whole or just incrementally change it:
    //    - if note is changed, retrieve its index, insert different object
    //    instead of it
    //    - if note is deleted, insert null instead of it, when # of nulls
    //    reaches half of the index, we rebuild it, amortized cost is still
    //    O(1)
    //
    // Incremental updates would make sense in case of a large index. But we
    // still will change the file, requiring sveltekit to reload it and read it
    // whole again, so it might not make sense even for large indices.
    await this.generateIndex()

    return previousResults
  }

  async indexNote(notePath) {
    const file = await this.retextPipepline.process(readSync(notePath))

    const slug = file.data.slug
    this.index.set(slug, {
      slug,
      title: file.data.title,
      content: file.value,
      matter: { ...file.data.matter },
    })
  }

  unindexNote(slug) {
    this.index.delete(slug)
  }

  async generateIndex() {
    const index = [...this.index.values()]

    const indexPath = path.join(this.config.savePath, '__search.json')
    await saveJSON(indexPath, index)
  }
}

