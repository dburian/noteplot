import path from 'path';
import { visit, EXIT, SKIP, CONTINUE } from 'unist-util-visit';
import { matter } from 'vfile-matter';
import toString from 'unist-util-to-string-with-nodes';
import readingTime from 'reading-time';

import { toSlug } from '../slug.js';

/*
 * The unified plugins `parse_note.js` assembles. Every one of them is local to
 * the note being parsed: none reads or writes state shared across notes. That
 * is what lets a note be parsed in a worker and its result cached by content
 * hash. Backlinks used to be collected right here, into a map held in processor
 * data; the corpus derives them now.
 *
 * Nothing in here logs. This runs in worker threads, where a pino transport
 * would be one more thread per worker; problems go into `file.data.warnings`
 * and are logged by the main thread.
 */

function isURL(str) {
  try {
    return Boolean(new URL(str));
  } catch (e) {
    return false;
  }
}

/**
 * @param {import('vfile').VFile} file
 * @param {string} message
 */
function warn(file, message) {
  (file.data.warnings ??= []).push(message);
}

export function addFrontmatter() {
  return (tree, file) => {
    // `matter` throws on an empty frontmatter block (`---\n---` hands the YAML
    // parser `undefined`) and on malformed YAML. Unguarded, one bad note aborts
    // the whole batch and nothing at all gets written.
    try {
      //Assigns parsed matter to file.data.matter
      matter(file);
    } catch (error) {
      warn(file, `Could not parse the frontmatter of ${file.path}: ${error.message}`);
    }

    // `matter` is `null` whenever the block parses to nothing -- a comment-only
    // block, say -- and every consumer indexes into it.
    file.data.matter = file.data.matter || {};
  };
}

/**
 * Rewrites every local image to its URL under `imgUrl` and records where it has
 * to be copied from and to. Copying is the assets emitter's job, not the
 * parser's: a cached record must not depend on a side effect having happened.
 */
export function collectImgs({ imgUrl, noteRoot }) {
  return (tree, file) => {
    /** @type {{src: string, dest: string}[]} */
    const images = [];
    visit(tree, 'image', (node) => {
      if (isURL(node.url)) return SKIP;

      const src = path.resolve(file.dirname, node.url);
      const dest = toSlug(src, noteRoot, { withExtension: true });
      node.url = path.join(imgUrl, dest);

      images.push({ src, dest });
      return CONTINUE;
    });

    file.data.images = images;
  };
}

export function addSlug({ noteRoot }) {
  return function (_, file) {
    file.data.slug = toSlug(file.path, noteRoot);
  };
}

export function addTitle() {
  return function (tree, file) {
    visit(tree, 'heading', (node) => {
      const { text } = toString(node);
      file.data.title = text;

      return EXIT;
    });

    if (!file.data.title) {
      // Backup title
      file.data.title = file.stem[0].toUpperCase() + file.stem.slice(1).replaceAll(/[-_]/g, ' ');
    }
  };
}

/**
 * Collects the slugs this note links to, and rewrites each local link to its
 * slug with a `data-slug` attribute the frontend hooks hover highlighting on.
 */
export function addLinks({ noteRoot }) {
  return (tree, file) => {
    const links = new Set();

    visit(tree, 'link', (node) => {
      // TODO: Add class for outside links.
      if (isURL(node.url)) return SKIP;

      const linkDest = path.resolve(file.dirname, node.url);
      const slugLinkDest = toSlug(linkDest, noteRoot);
      node.url = slugLinkDest;

      //Adding data that will get transformed to hast properties with
      //remarkRehype. See https://github.com/syntax-tree/mdast-util-to-hast/tree/main?tab=readme-ov-file#fields-on-nodes
      node.data = { hProperties: { 'data-slug': slugLinkDest } };

      links.add(slugLinkDest);
    });

    file.data.linkSlugs = [...links];
  };
}

export function addReadingTime() {
  return (tree, file) => {
    const { text } = toString(tree);
    file.data.readingTime = readingTime(text);
  };
}

export function removeFirstHeader() {
  return (tree) => {
    if (!('children' in tree)) return;

    for (let i = 0; i < tree.children.length; i++) {
      if (tree.children[i].type === 'heading') {
        tree.children.splice(i, 1);
        break;
      }
    }
  };
}

/**
 * Wraps every top-level element except `mjx-container` in
 * `<div class="prose-high-level-tag">`, which `Prose.svelte` caps at 65ch. See
 * "`Prose.svelte` and the max-width mechanism" in `src/lib/CLAUDE.md`.
 */
export function rehypeWrapTextElems() {
  const wrapWithMaxWidthNode = (node) => {
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: 'prose-high-level-tag'
      },
      children: [node]
    };
  };

  return (tree) => {
    const newChildren = [];
    for (const c of tree.children) {
      if (c.tagName != 'mjx-container') {
        newChildren.push(wrapWithMaxWidthNode(c));
      } else {
        newChildren.push(c);
      }
    }

    tree.children = newChildren;
  };
}
