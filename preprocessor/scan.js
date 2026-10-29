import { readdir } from 'node:fs/promises';
import path from 'node:path';
import Watcher from 'watcher';

import { logger } from './log.js';

const NOTE_EXTENSION = '.md';

/**
 * Only Markdown files are notes. Everything else in the note tree -- images,
 * editor swap files, whatever else the user keeps next to their notes -- must
 * never reach the parser.
 *
 * @param {string} targetPath
 */
function isNote(targetPath) {
  return path.extname(targetPath) == NOTE_EXTENSION;
}

/**
 * @typedef {{eventType: 'add' | 'change' | 'unlink', targetPath: string}} NoteEvent
 */

/**
 * Finds the notes: once at startup, and then, if asked, on every change.
 *
 * It decides what a note *is* and turns filesystem noise into batches. What a
 * batch means for the collection is the corpus's business.
 */
export class NoteScanner {
  /**
   * @param {string} noteRoot absolute
   * @param {{debounce: number}} opts
   */
  constructor(noteRoot, { debounce }) {
    this.noteRoot = noteRoot;
    this.debounce = debounce;
  }

  /**
   * Whether a path inside the note tree is one we refuse to look at.
   *
   * Used both as `watcher`'s `ignore` predicate and by `listNotes()`, so that
   * the startup scan and the watcher agree on what a note is (ISSUES.md A15).
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
   * leading `..`. Getting this wrong silently drops every event (ISSUES.md A0).
   *
   * @param {string} targetPath
   */
  isIgnored(targetPath) {
    const absPath = path.resolve(this.noteRoot, targetPath);
    const relPath = path.relative(this.noteRoot, absPath);

    const isHidden = relPath
      .split(path.sep)
      .some((segment) => segment != '.' && segment != '..' && segment.startsWith('.'));

    if (isHidden) {
      logger.debug(`${targetPath} is hidden. Ignoring...`);
      return true;
    }

    return false;
  }

  /**
   * Every note under the root, as absolute paths.
   *
   * @returns {Promise<string[]>}
   */
  async listNotes() {
    const dirEntries = await readdir(this.noteRoot, { withFileTypes: true, recursive: true });

    const notes = [];
    for (const entry of dirEntries) {
      if (!entry.isFile() || !isNote(entry.name)) continue;

      // The joined path, not `entry.name`: every segment has to be tested, or a
      // note inside a hidden directory slips through. `readdir` still descends
      // into `.git` -- `recursive: true` gives no way to prune a directory --
      // so this filters the walk rather than avoiding it.
      const targetPath = path.join(entry.parentPath, entry.name);
      if (this.isIgnored(targetPath)) continue;

      notes.push(targetPath);
    }
    return notes;
  }

  /**
   * Watches the root and calls `onBatch` with each debounce window's events.
   *
   * Batches are **serialised**: a window that closes while the previous batch
   * is still being processed waits for it, and everything that arrived in the
   * meantime goes in one batch after it. Two batches running at once would
   * apply their changes to the corpus in whatever order they finished.
   *
   * @param {(events: NoteEvent[]) => Promise<void>} onBatch
   */
  watch(onBatch) {
    logger.info('Watching for changes...');

    /** @type {NoteEvent[]} */
    let queued = [];
    /** @type {NodeJS.Timeout | null} */
    let timer = null;
    let running = false;

    const flush = async () => {
      timer = null;
      if (running || queued.length == 0) return;

      running = true;
      const events = coalesceEvents(queued);
      queued = [];
      try {
        await onBatch(events);
      } finally {
        running = false;
        // Whatever arrived while this batch ran.
        if (queued.length > 0 && timer === null) flush();
      }
    };

    const watcher = new Watcher(this.noteRoot, {
      recursive: true,
      ignoreInitial: true,
      ignore: (targetPath) => this.isIgnored(targetPath)
    });

    const actionableEvents = new Set([
      'add', // new note
      'unlink', // deleted note
      'change' // change content of the note
    ]);

    watcher.on('all', (eventType, targetPath) => {
      if (!actionableEvents.has(eventType)) return;
      if (!isNote(targetPath)) {
        logger.debug(`${targetPath} is not a note. Ignoring...`);
        return;
      }
      logger.debug(`Event ${eventType} fired on ${targetPath}`);

      queued.push({
        eventType,
        // Absolute: Node's `fs.watch` reports paths relative to the root.
        targetPath: path.resolve(this.noteRoot, targetPath)
      });
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, this.debounce);
    });

    return watcher;
  }
}

/**
 * Collapses one debounce window's events down to at most one event per path.
 *
 * `unlink` wins over everything -- the file is gone. Otherwise the path is
 * read again whatever happened, so any `add` or `change` stands for all of
 * them; a removal followed by a re-creation is a change. The corpus decides
 * whether a note is new, so `add` and `change` mean the same thing downstream.
 *
 * @param {NoteEvent[]} events
 * @returns {NoteEvent[]}
 */
export function coalesceEvents(events) {
  /** @type {Map<string, NoteEvent>} */
  const byPath = new Map();

  for (const event of events) {
    const previous = byPath.get(event.targetPath);

    if (!previous || event.eventType == 'unlink') {
      byPath.set(event.targetPath, event);
    } else if (previous.eventType == 'unlink') {
      byPath.set(event.targetPath, { ...event, eventType: 'change' });
    }
  }

  return [...byPath.values()];
}
