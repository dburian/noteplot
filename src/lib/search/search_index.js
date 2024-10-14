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
