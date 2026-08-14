import MiniSearch from "minisearch";

/**
  * @typedef {{slug: string, content: string, title: string, matter: import("$lib/graph/canvas_graph").FrontMatter}} Note
  */

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

