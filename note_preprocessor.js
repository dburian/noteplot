import path from 'path';

import { writeFile } from 'fs/promises';
import Watcher from 'watcher';
import { readdir } from 'fs/promises';
import { logger } from './unify_pipelines.js';
import { clearTimeout, setTimeout } from 'timers';
import { NotePipeline } from './note_pipeline.js';
import { GraphPipeline } from './graph_pipeline.js';
import { SearchIndexPipeline } from './search_index_pipeline.js';

export function saveJSON(path, object) {
  logger.info(`Writing out ${path}.`)
  return writeFile(
    path,
    JSON.stringify(object),
    { encoding: 'utf8' }
  )
}


/**
  *
  * @param {{
      * watch: boolean,
      * savePath: string,
      * imgSavePath: string,
      * imgUrl: string,
      * noteRoot: string
    * }} config
  */
export async function preprocess(config) {
  const { watch, ...updaterConfig } = config
  const updater = new NotesUpdater(updaterConfig)

  await updater.updateAll()

  if (watch) {
    updater.watch()
  }
}


class NotesUpdater {
  constructor(config) {
    this.config = config
    this.config.watch_debounce = this.config.watch_debounce || 2000

    this._events_to_process = []
    this._watch_debounce_timer = null

    this.pipelines = [
      new NotePipeline(config),
      new GraphPipeline(config),
      new SearchIndexPipeline(config),
    ]
  }


  async on(events) {
    let res = null
    for (const pipeline of this.pipelines) {
      res = await pipeline.on(events, res)
    }

    return res
  }

  flush_events = () => {
    const events = this._events_to_process
    this._events_to_process = []
    this.on(events)
  }

  async updateAll() {
    const dirEntries = await readdir(this.config.noteRoot, {
      withFileTypes: true,
      recursive: true
    })

    for (const entry of dirEntries) {
      if (entry.isFile() && path.extname(entry.name) == '.md') {
        this._events_to_process.push({
          eventType: 'add',
          targetPath: path.join(entry.path || entry.parentPath, entry.name)
        })
      }
    }

    this.flush_events()
  }

  watch() {
    logger.info("Watching for changes...")

    const ignoreFn = (absPath) => {
      const relPath = path.relative(this.config.noteRoot, absPath)

      if (/^\./.test(relPath)) {
        logger.debug(`${absPath} starts with a dot. Ignoring...`)
        return true;
      }

      return false;
    }

    const watcher = new Watcher(this.config.noteRoot, { recursive: true, ignoreInitial: true, ignore: ignoreFn })

    const actionableEvents = new Set([
      'add', // new note
      'unlink', // deleted note
      'change', // change content of the note
    ])

    watcher.on("all", (eventType, targetPath) => {
      if (!actionableEvents.has(eventType)) return
      logger.debug(`Event ${eventType} fired on ${targetPath}`)

      this._events_to_process.push({ eventType, targetPath })
      if (this._watch_debounce_timer !== null) {
        clearTimeout(this._watch_debounce_timer)
      }

      this._watch_debounce_timer = setTimeout(this.flush_events, this.config.watch_debounce)
    })
  }
}
