import FlexSearch from "flexsearch";
import MiniSearch from "minisearch";


export class NoLibSearchIndex {
  constructor(haystack, matches_per_note = 100) {
    this.debounceTimeout = null
    this.matches_per_note = matches_per_note

    for (const note of haystack) {
      note.titleLower = note.title.toLowerCase()
      note.contentLower = note.content.toLowerCase()
    }

    this.haystack = haystack
  }


  /**
    * @param {string} context
    * @param {Number} beginIdx
    * @param {string} searchString
    * @param {Number} charsAround
    */
  extractMatch(context, beginIdx, searchString, charsAround) {
    const endIdx = beginIdx + searchString.length
    const contextBeginIdx = Math.max(0, beginIdx - charsAround)
    const contextEndIdx = Math.min(context.length, endIdx + charsAround)

    return {
      'before': context.slice(contextBeginIdx, beginIdx),
      'match': context.slice(beginIdx, endIdx),
      'after': context.slice(endIdx, contextEndIdx),
    }
  }

  /**
    * @param {string} context
    * @param {string} searchString
    * @param {Number} numCharsAround
    */
  extractAllMatches(context, searchString, numCharsAround) {
    let beginIdx = context.indexOf(searchString)
    const allMatches = []
    while (beginIdx >= 0 && allMatches.length < this.matches_per_note) {
      allMatches.push(this.extractMatch(context, beginIdx, searchString, numCharsAround))
      beginIdx = context.indexOf(searchString, beginIdx + 1)
    }

    return allMatches
  }

  /**
    * @param {string} searchString String to be searched.
    */
  async search(searchString) {
    const newMatches = []
    const searchTerm = searchString.toLowerCase()
    for (const note of this.haystack) {
      const noteMatches = {
        title: [],
        content: [],
        note: { ...note },
        score: 0,
      }

      if (note.titleLower.includes(searchTerm)) {
        noteMatches.title = this.extractAllMatches(note.titleLower, searchString, note.title.length)
        noteMatches.score += noteMatches.title.length
      }

      if (note.contentLower.includes(searchTerm)) {
        noteMatches.content = this.extractAllMatches(note.contentLower, searchString, 20)
        noteMatches.score += noteMatches.content.length
      }


      if (noteMatches.score > 0) {
        newMatches.push(noteMatches)
      }
    }
    return newMatches.sort((a, b) => b.score - a.score);
  }
}

/**
  * @typedef {{slug: string, content: string, title: string, matter: import("$lib/graph/canvas_graph").FrontMatter}} Note
  */

export class FlexSearchIndex {
  /**
    * @param {Array<Note>} notes
    */
  constructor(notes) {
    this.index = new FlexSearch.Document({
      document: {
        id: 'id',
        index: [
          {
            field: 'content'
          }, {
            field: 'title',
            tokenize: "full"
          }, {
            field: 'tags',
            tokenize: "full"
          },
        ]
      },
    })

    this.id_to_note = new Map()
    let id = 0
    this.constructPromises = []
    for (const note of notes) {
      this.id_to_note[id] = { ...note };

      this.constructPromises.push(
        this.index.addAsync(id, { content: note.content, title: note.title, tags: note.matter?.tags || [] })
      )

      id += 1;
    }
  }

  async ready() {
    if (this.constructPromises.length > 0) {
      await Promise.all(this.constructPromises)
    }

    this.constructPromises = []
  }

  /**
    * @param {string} searchString
    */
  async search(searchString) {
    if (searchString.length == 0) return []

    const results = await this.index.searchAsync(searchString, { limit: 100, suggest: true, })
    if (results.length == 0) return []

    /** @type {Map<Number, string[]>} */
    const matchedIds = new Map()

    for (const fieldResults of results) {
      for (const noteId of fieldResults.result) {
        const notesMatchedFields = matchedIds.get(noteId) || []
        matchedIds.set(noteId, [...notesMatchedFields, fieldResults.field])
      }
    }

    const matchedNotes = []
    for (const [noteId, matchedFields] of matchedIds) {
      matchedNotes.push({
        note: this.id_to_note[noteId],
        matchedFields
      })
    }

    return matchedNotes
  }
}

/**
 * @typedef {{
   * note: Note,
   * score: number,
   * matchedFields: import("minisearch").MatchInfo[],
 * }} Match
*/

export class MiniSearchIndex {
  /**
    * @param {Array<Note>} notes
    */
  constructor(notes) {
    this.index = new MiniSearch({
      idField: 'id',
      fields: ['content', 'title', 'tag'],
      extractField: (document, fieldName) => {
        if (fieldName === 'tag') {
          return document.matter.tags ? document.matter.tags.join(' ') : ''
        }

        return document[fieldName]
      }
    })

    this.notesById = []
    for (const note of notes) {
      /** @type {Number} */
      const id = this.notesById.length
      this.notesById.push({ id, ...note });
    }

    this.costructionPromise = this.index.addAllAsync(this.notesById)
  }

  async ready() {
    await this.costructionPromise
  }

  /**
    * @param {import("minisearch").Query} query
    * @returns Match[]
    */
  search(query) {
    const results = this.index.search(query)
    const matches = []
    for (const result of results) {
      matches.push({
        note: this.notesById[result.id],
        score: result.score,
        matchedFields: result.match
      })
    }
    return matches
  }

  /**
    * @param {String} searchString
    *
    * @returns {import("minisearch").Query}
    */
  parseSearchString(searchString) {
    if (searchString.length == 0) return ''

    /** @type String[] */
    const blocks = []
    const quoteSep = searchString.split('"')

    //If even number of blocks, there are odd number of quotes
    if (quoteSep.length % 2 == 0) {
      quoteSep[quoteSep.length - 1] = quoteSep[quoteSep.length - 2] + '"' + quoteSep.pop()
    }

    let inBetweenQuotes = false
    for (const block of quoteSep) {
      if (block.length > 0) {
        if (inBetweenQuotes) {
          blocks.push(block)
        } else {
          for (const subBlock of block.split(' ')) {
            if (subBlock.length > 0) {
              blocks.push(subBlock)
            }
          }
        }
      }

      inBetweenQuotes = !inBetweenQuotes
    }

    const allowedFieldNames = this.index._options.fields
    /** @type {import("minisearch").Query[]} */
    const queries = []
    for (const block of blocks) {
      if (!block.includes(":")) {
        queries.push({
          queries: [block],
          fields: [...allowedFieldNames],
        })
        continue
      }

      const fieldEndIdx = block.indexOf(':')

      const field = block.slice(0, fieldEndIdx)
      if (!allowedFieldNames.includes(field)) {
        queries.push({
          queries: [block],
          fields: [...allowedFieldNames],
        })
        continue
      }

      queries.push({
        fields: [field],
        queries: [block.slice(fieldEndIdx + 1, block.length)],
      })
    }

    return { queries, combineWith: "AND" }
  }
}

