import { createAssetsEmitter } from './assets.js';
import { createDateGraphEmitter } from './graph/dates.js';
import { createLinksGraphEmitter } from './graph/links.js';
import { createTagsGraphEmitter } from './graph/tags.js';
import { indexEmitter } from './index_json.js';
import { notesEmitter } from './notes.js';
import { searchEmitter } from './search.js';

/**
 * Every output the preprocessor produces. **Adding an output is adding an entry
 * here**, and nothing else in the preprocessor changes: the orchestrator runs
 * each emitter whose `deps` a batch touched, concurrently, and they share
 * nothing but the read-only corpus.
 *
 * A new graph is a `defineGraphEmitter` (see `graph/tags.js` for a small one)
 * plus a descriptor in `src/lib/viz/registry.js` whose `dataId` names it.
 *
 * A function rather than a constant, because some emitters keep state across
 * batches and each preprocessor run needs its own.
 *
 * @returns {import('../types.js').Emitter[]}
 */
export function createEmitters() {
  return [
    notesEmitter,
    createAssetsEmitter(),
    indexEmitter,
    searchEmitter,
    createLinksGraphEmitter(),
    createTagsGraphEmitter(),
    createDateGraphEmitter()
  ];
}
