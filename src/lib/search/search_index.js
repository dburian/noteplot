import MiniSearch from 'minisearch';

/**
 * @typedef {{slug: string, content: string, title: string, matter: import("$lib/viz/force_graph/canvas_graph").FrontMatter}} Note
 */

/**
 * `matchedFields` is minisearch's `match`: a `{term: [field, ...]}` map, not an
 * array of them. It was typed as an array, which nothing noticed while the only
 * consumer read it back with `Object.getOwnPropertyNames`.
 *
 * @typedef {{
 * note: Note,
 * score: number,
 * matchedFields: import("minisearch").MatchInfo,
 * }} Match
 */

/**
 * The indexed fields, and the ones `field:term` may name. A module constant
 * rather than `this.index._options.fields`, which is `protected` — reading it
 * worked but is not ours to read, and one list is the point anyway: the query
 * parser must not be able to disagree with what was indexed.
 *
 * @type {Array<string>}
 */
const FIELDS = ['content', 'title', 'tag'];

/**
 * Memoised on the `notes` reference, which is stable: `loadSearchNotes()` in
 * `$lib/notes_route.js` returns the same promise every call, so the search and
 * filter overlays hand out the same array from the one `__search.json` module.
 * Without this, opening either overlay re-indexed the whole corpus
 * (ISSUES.md B3). Callers must `await index.ready()` before `search()`
 * (ISSUES.md B4) — the index is built asynchronously.
 *
 * @type {{notes: Array<Note>, index: MiniSearchIndex} | null}
 */
let sharedIndex = null;

/**
 * @param {Array<Note>} notes
 * @returns {MiniSearchIndex}
 */
export function getSearchIndex(notes) {
  if (sharedIndex?.notes !== notes) {
    sharedIndex = { notes, index: new MiniSearchIndex(notes) };
  }

  return sharedIndex.index;
}

export class MiniSearchIndex {
  /**
   * @param {Array<Note>} notes
   */
  constructor(notes) {
    this.index = new MiniSearch({
      idField: 'id',
      fields: FIELDS,
      extractField: (document, fieldName) => {
        if (fieldName === 'tag') {
          return document.matter?.tags ? document.matter.tags.join(' ') : '';
        }

        return document[fieldName];
      }
    });

    this.notesById = [];
    for (const note of notes) {
      /** @type {Number} */
      const id = this.notesById.length;
      this.notesById.push({ id, ...note });
    }

    this.costructionPromise = this.index.addAllAsync(this.notesById);
  }

  async ready() {
    await this.costructionPromise;
  }

  /**
   * @param {import("minisearch").Query} query
   * @returns {Match[]}
   */
  search(query) {
    const results = this.index.search(query);
    const matches = [];
    for (const result of results) {
      matches.push({
        note: this.notesById[result.id],
        score: result.score,
        matchedFields: result.match
      });
    }
    return matches;
  }

  /**
   * @param {String} searchString
   *
   * @returns {import("minisearch").Query}
   */
  parseSearchString(searchString) {
    if (searchString.length == 0) return '';

    /** @type String[] */
    const blocks = [];
    const quoteSep = searchString.split('"');

    //If even number of blocks, there are odd number of quotes
    if (quoteSep.length % 2 == 0) {
      quoteSep[quoteSep.length - 1] = quoteSep[quoteSep.length - 2] + '"' + quoteSep.pop();
    }

    let inBetweenQuotes = false;
    for (const block of quoteSep) {
      if (block.length > 0) {
        if (inBetweenQuotes) {
          blocks.push(block);
        } else {
          for (const subBlock of block.split(' ')) {
            if (subBlock.length > 0) {
              blocks.push(subBlock);
            }
          }
        }
      }

      inBetweenQuotes = !inBetweenQuotes;
    }

    const allowedFieldNames = FIELDS;
    /** @type {import("minisearch").Query[]} */
    const queries = [];
    for (const block of blocks) {
      if (!block.includes(':')) {
        queries.push({
          queries: [block],
          fields: [...allowedFieldNames]
        });
        continue;
      }

      const fieldEndIdx = block.indexOf(':');

      const field = block.slice(0, fieldEndIdx);
      if (!allowedFieldNames.includes(field)) {
        queries.push({
          queries: [block],
          fields: [...allowedFieldNames]
        });
        continue;
      }

      queries.push({
        fields: [field],
        queries: [block.slice(fieldEndIdx + 1, block.length)]
      });
    }

    return { queries, combineWith: 'AND' };
  }
}
