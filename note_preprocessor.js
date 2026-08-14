import path from 'path';

import { writeFile } from 'fs/promises';
import Watcher from 'watcher';
import { readdir } from 'fs/promises';
import { logger } from './unify_pipelines.js';
import { clearTimeout, setTimeout } from 'timers';
import { NotePipeline } from './note_pipeline.js';
import { GraphPipeline } from './graph_pipeline.js';
import { SearchIndexPipeline } from './search_index_pipeline.js';

const NOTE_EXTENSION = '.md'

/**
  * Only Markdown files are notes. Everything else in the note tree -- images,
  * editor swap files, whatever else the user keeps next to their notes -- must
  * never reach the Markdown pipelines.
  *
  * @param {string} targetPath
  */
function isNote(targetPath) {
  return path.extname(targetPath) == NOTE_EXTENSION
}

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

  /**
    * Collapses one debounce window's events down to at most one event per path.
    *
    * Without this, a file created and then edited inside a single window
    * produces both an `add` and a `change`, and `NotePipeline` cannot serve the
    * `change`: the note it diffs against has not been enriched with `links`
    * yet. `watcher` does the same collapsing inside its own 300ms window; this
    * extends it to the (much longer) window we debounce over.
    *
    * `unlink` wins over everything -- the file is gone. `add` wins over
    * `change`, because the pipelines re-read the file from disk anyway, so a
    * single `add` already carries the latest content.
    *
    * @param {Array<{eventType: string, targetPath: string}>} events
    */
  _coalesceEvents(events) {
    const byPath = new Map()

    for (const event of events) {
      const previous = byPath.get(event.targetPath)

      if (!previous || event.eventType == 'unlink') {
        byPath.set(event.targetPath, event)
      } else if (previous.eventType == 'unlink') {
        // Removed and re-created within one window: the note existed before and
        // exists now, so what happened to it is a change.
        byPath.set(event.targetPath, { ...event, eventType: 'change' })
      }
      // Otherwise `previous` is the `add`/`change` we want to keep.
    }

    return [...byPath.values()]
  }

  flush_events = async () => {
    const events = this._coalesceEvents(this._events_to_process)
    this._events_to_process = []

    // The watcher calls this from a timer, where a rejection would become an
    // unhandled rejection and take the whole process down. One bad note should
    // cost us that note, not the watcher.
    try {
      await this.on(events)
    } catch (error) {
      logger.error(error, "Failed to process a batch of note changes.")
    }
  }

  async updateAll() {
    const dirEntries = await readdir(this.config.noteRoot, {
      withFileTypes: true,
      recursive: true
    })

    for (const entry of dirEntries) {
      if (entry.isFile() && isNote(entry.name)) {
        this._events_to_process.push({
          eventType: 'add',
          targetPath: path.join(entry.path || entry.parentPath, entry.name)
        })
      }
    }

    await this.flush_events()
  }

  watch() {
    logger.info("Watching for changes...")

    // `ignore` is handed three different shapes of path, so it cannot assume
    // any one of them:
    //   - absolute paths, from `watcher` itself and from `tiny-readdir`
    //   - paths relative to the watched directory, from Node's own
    //     `FSWatcher._ignoreMatcher` -- this is how every file event arrives
    //   - ancestors of `noteRoot`, which `watcher` walks up so it can notice
    //     the note root itself being created or removed
    //
    // Resolving against `noteRoot` normalises the first two shapes. Testing
    // each segment for a leading dot -- rather than testing the joined
    // relative path -- keeps the third shape from being rejected for its
    // leading `..`.
    const ignoreFn = (targetPath) => {
      const absPath = path.resolve(this.config.noteRoot, targetPath)
      const relPath = path.relative(this.config.noteRoot, absPath)

      const isHidden = relPath
        .split(path.sep)
        .some(segment => segment != '.' && segment != '..' && segment.startsWith('.'))

      if (isHidden) {
        logger.debug(`${targetPath} is hidden. Ignoring...`)
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
      if (!isNote(targetPath)) {
        logger.debug(`${targetPath} is not a note. Ignoring...`)
        return
      }
      logger.debug(`Event ${eventType} fired on ${targetPath}`)

      this._events_to_process.push({ eventType, targetPath })
      if (this._watch_debounce_timer !== null) {
        clearTimeout(this._watch_debounce_timer)
      }

      this._watch_debounce_timer = setTimeout(this.flush_events, this.config.watch_debounce)
    })
  }
}
