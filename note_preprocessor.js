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
  * Runs every pipeline over the note tree once, then optionally keeps watching.
  *
  * Returns the number of notes that made it through, which `index.js` uses to
  * refuse a build of an empty collection (ISSUES.md A18).
  *
  * @param {{
      * watch: boolean,
      * savePath: string,
      * imgSavePath: string,
      * imgUrl: string,
      * noteRoot: string
    * }} config
  * @returns {Promise<number>}
  */
export async function preprocess(config) {
  const { watch, ...updaterConfig } = config
  const updater = new NotesUpdater(updaterConfig)

  const noteCount = await updater.updateAll()

  if (watch) {
    updater.watch()
  }

  return noteCount
}


class NotesUpdater {
  constructor(config) {
    this.config = config
    this.config.watch_debounce = this.config.watch_debounce || 2000

    this._events_to_process = []
    this._watch_debounce_timer = null

    // Held by name as well as in the array: `updateAll` needs it for the
    // orphaned-image sweep, and `this.pipelines[0]` is a worse way to say so.
    this.notePipeline = new NotePipeline(config)
    this.pipelines = [
      this.notePipeline,
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
      return await this.on(events)
    } catch (error) {
      logger.error(error, "Failed to process a batch of note changes.")
      return null
    }
  }

  /**
    * Whether a path inside the note tree is one we refuse to look at.
    *
    * Used both as `watcher`'s `ignore` predicate and by `updateAll()`, so that
    * the startup scan and the watcher agree on what a note is. They did not:
    * the scan filtered on the extension alone, so `.hidden.md` was indexed once
    * and never updated again, and a `.git` directory full of `.md` files was
    * picked up wholesale.
    *
    * As `watcher`'s predicate this is handed three different shapes of path, so
    * it cannot assume any one of them:
    *   - absolute paths, from `watcher` itself and from `tiny-readdir`
    *   - paths relative to the watched directory, from Node's own
    *     `FSWatcher._ignoreMatcher` -- this is how every file event arrives
    *   - ancestors of `noteRoot`, which `watcher` walks up so it can notice
    *     the note root itself being created or removed
    *
    * Resolving against `noteRoot` normalises the first two shapes. Testing
    * each segment for a leading dot -- rather than testing the joined
    * relative path -- keeps the third shape from being rejected for its
    * leading `..`.
    *
    * @param {string} targetPath
    */
  _isIgnored(targetPath) {
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

  async updateAll() {
    const dirEntries = await readdir(this.config.noteRoot, {
      withFileTypes: true,
      recursive: true
    })

    for (const entry of dirEntries) {
      if (!entry.isFile() || !isNote(entry.name)) continue

      // The joined path, not `entry.name`: every segment has to be tested, or a
      // note inside a hidden directory slips through. `readdir` still descends
      // into `.git` -- `recursive: true` gives no way to prune a directory --
      // so this filters the walk rather than avoiding it.
      const targetPath = path.join(entry.path || entry.parentPath, entry.name)
      if (this._isIgnored(targetPath)) continue

      this._events_to_process.push({ eventType: 'add', targetPath })
    }

    // `NotePipeline` is the only pipeline that produces anything, and its
    // `notes` map is threaded through to the last one, so the final result is
    // where the note count already lives.
    const result = await this.flush_events()

    // Only on a scan that came back clean. `flush_events` swallows a failed
    // batch and returns `null`, and after one the image map is missing whatever
    // that batch would have referenced -- sweeping then deletes images that are
    // still in use.
    if (result !== null) {
      await this.notePipeline.pruneOrphanImages()
    }

    return result?.notes?.size ?? 0
  }

  watch() {
    logger.info("Watching for changes...")

    const watcher = new Watcher(this.config.noteRoot, {
      recursive: true,
      ignoreInitial: true,
      ignore: (targetPath) => this._isIgnored(targetPath)
    })

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
