/**
 * Structural equality for JSON-shaped values: what the corpus uses to decide
 * which fields of a re-parsed note actually changed.
 *
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function isDeepEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length != b.length) return false;

    // A plain loop, not `new Array(a.length).every(...)`: that array is sparse,
    // `.every` skips holes, so the callback never ran and any two arrays of the
    // same length compared equal.
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }

    return true;
  }

  // `typeof null == 'object'`, so this has to come before the object branch --
  // `Object.getOwnPropertyNames(null)` throws. A frontmatter key with an empty
  // value (`key:`) parses to `null`, so it is reachable from a note.
  if (a === null || b === null) return a === b;

  if (typeof a == 'object' || typeof b == 'object') {
    if (typeof a != 'object' || typeof b != 'object') return false;

    const aKeys = Object.getOwnPropertyNames(a);
    const bKeys = Object.getOwnPropertyNames(b);

    if (!isDeepEqual(aKeys, bKeys)) {
      return false;
    }

    for (const k of aKeys) {
      if (!isDeepEqual(a[k], b[k])) {
        return false;
      }
    }

    return true;
  }

  return a == b;
}

/**
 * Sorts by `slug`. Every artifact is written in slug order, so its bytes depend
 * only on the collection and not on which worker finished first -- which is
 * what lets `ArtifactWriter` skip rewriting a file that did not change.
 *
 * @template {{slug: string}} T
 * @param {Iterable<T>} items
 * @returns {T[]}
 */
export function bySlug(items) {
  return [...items].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
