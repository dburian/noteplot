import path from 'path';

/**
 * A file path, relative to `sourceRoot`, as a URL slug.
 *
 * `-` stands in for the path separator, so a literal `-` -- and the `~` that
 * escapes it -- has to be escaped, otherwise sourceRoot/dir/note.md and
 * sourceRoot/dir-note.md collide. `~` first, so the `~` the second pass
 * introduces is left alone. Injective: `~` always starts a two-character token
 * and a lone `-` is always a separator. See the Slugs section of the root
 * `CLAUDE.md`.
 *
 * @param {string} fullFilePath
 * @param {string} sourceRoot
 * @param {{withExtension?: boolean}} [opts]
 */
export function toSlug(fullFilePath, sourceRoot, { withExtension } = { withExtension: false }) {
  let slugPath = path.relative(sourceRoot, fullFilePath);
  if (!withExtension) {
    slugPath = slugPath.slice(0, -path.extname(slugPath).length);
  }

  slugPath = slugPath.replaceAll('~', '~~').replaceAll('-', '~-');

  return slugPath.replaceAll(path.sep, '-');
}

/**
 * A note's path relative to the note root, with `/` separators -- the display
 * location the frontend shows, so nothing ever has to invert `toSlug`.
 *
 * `resolve` first: a path reaches the preprocessor both absolute and relative
 * to the note root, and `path.relative` on the latter would resolve it against
 * the CWD -- which `index.js` has `chdir`ed away from -- and produce a
 * plausible-looking `../../..` rather than an error. Then to `/`, because
 * `path.sep` is platform state and this is data for a browser.
 *
 * @param {string} notePath
 * @param {string} noteRoot
 */
export function toDisplayPath(notePath, noteRoot) {
  return path.relative(noteRoot, path.resolve(noteRoot, notePath)).split(path.sep).join('/');
}
