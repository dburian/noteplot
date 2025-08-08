import remarkFrontmatter from 'remark-frontmatter';
import { visit, EXIT, SKIP, CONTINUE } from 'unist-util-visit';
import inlineLinks from 'remark-inline-links';
import { copyFile } from 'fs/promises';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { inspect } from 'util';
import rehypeShiki from '@shikijs/rehype';
import path from 'path';
import stripMarkdown from 'strip-markdown';
import remarkStringify from 'remark-stringify';
import rehypeFigure from '@microflash/rehype-figure';
import pino from 'pino';
import { matter } from 'vfile-matter';
import toString from 'unist-util-to-string-with-nodes';
import readingTime from 'reading-time';
import { transformerNotationHighlight } from '@shikijs/transformers';

export const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
  level: 'debug',
})

function isURL(str) {
  try {
    return Boolean(new URL(str));
  } catch (e) {
    return false;
  }

}

export function toSlug(fullFilePath, sourceRoot, { withExtension } = { withExtension: false }) {
  let slugPath = path.relative(sourceRoot, fullFilePath);
  if (!withExtension) {
    slugPath = slugPath.slice(0, -path.extname(slugPath).length);
  }

  // To make the slugs of sourceRoot/dir/note.md and sourceRoot/dir-note.md
  // distinct.
  slugPath = slugPath.replaceAll('-', '_')

  return slugPath.replaceAll(path.sep, '-')
}

function addFileData(data) {
  return (tree, file) => {
    file.data = Object.assign(file.data, data);
    file.data.originalPath = file.history[0]
  };
}

function addFrontmatter() {
  return (tree, file) => {
    //Assigns parsed matter to file.data.matter
    matter(file)
  }
}

function collectImgs({ imgUrl, imgSavePath }) {
  return async (tree, file) => {
    const copyPromises = []
    file.data.images = []
    visit(tree, 'image', node => {
      if (isURL(node.url)) return SKIP;

      const absolutePath = path.resolve(file.dirname, node.url)
      const imgSlug = toSlug(absolutePath, file.data.noteRoot, { withExtension: true })
      node.url = path.join(imgUrl, imgSlug)

      const destPath = path.join(imgSavePath, imgSlug)
      file.data.images.push(destPath)

      copyPromises.push(copyFile(absolutePath, destPath))
      return CONTINUE;
    })

    await Promise.all(copyPromises)
  };
}


function addSlug() {
  return function(_, file) {
    const slug = toSlug(file.path, file.data.noteRoot);

    file.data.slug = slug;
  };
}

function addTitle() {
  return function(tree, file) {
    visit(tree, 'heading', (node) => {
      const { text } = toString(node)
      file.data.title = text

      return EXIT
    })

    if (!file.data.title) {
      // Backup title
      file.data.title = file.stem[0].toUpperCase() + file.stem.slice(1).replaceAll(/[-_]/g, ' ')
    }
  }
}


function addLinks() {
  const backlinks = this.data().backlinks

  return (tree, file) => {
    const links = new Set()

    visit(tree, 'link', (node) => {
      // TODO: Add class for outside links.
      if (isURL(node.url)) return SKIP;

      const linkDest = path.resolve(file.dirname, node.url);
      const slugLinkDest = toSlug(linkDest, file.data.noteRoot);
      node.url = slugLinkDest;

      //Adding data that will get transformed to hast properties with
      //remarkRehype. See https://github.com/syntax-tree/mdast-util-to-hast/tree/main?tab=readme-ov-file#fields-on-nodes
      node.data = { 'hProperties': { 'data-slug': slugLinkDest } }

      links.add(slugLinkDest);

      // TODO: referencedBy would be probably more intuitive than 'backlinks'
      if (!backlinks.has(slugLinkDest)) {
        backlinks.set(slugLinkDest, new Set());
      }

      backlinks.get(slugLinkDest).add(file.data.slug);
    });

    file.data.linkSlugs = [...links];
  };
}

function addReadingTime() {
  return (tree, file) => {
    const { text } = toString(tree)
    file.data.readingTime = readingTime(text)
  };
}

function removeFirstHeader() {
  return (tree) => {
    if (!('children' in tree)) return

    for (let i = 0; i < tree.children.length; i++) {
      if (tree.children[i].type === 'heading') {
        tree.children.splice(i, 1)
        break;
      }
    }
  };
}

function rehypeWrapTextElems() {
  const wrapWithMaxWidthNode = (node) => {
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: 'prose-high-level-tag',
      },
      children: [node],
    }
  }

  return (tree, file) => {
    const newChildren = []
    for (const c of tree.children) {
      if (c.tagName != "mjx-container") {
        newChildren.push(wrapWithMaxWidthNode(c))
      } else {
        newChildren.push(c)
      }
    }

    tree.children = newChildren
  }
}

function printFile() {
  return async (tree, file) => {
    if (file.stem == 'transformer') {
      logger.debug(file.data.links);
    }
  };
}

function printTree() {
  return async (tree, file) => {
    if (file.stem == 'taylor_series') {
      logger.debug(`Printing tree for ${file.path}`)
      logger.debug(inspect(tree, true, 4));
    }
  };
}

function createMinimalRemarkPipeline({ noteRoot }) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(addFrontmatter)
    .use(remarkMath)
    .use(inlineLinks)
    // TODO: Maybe add `noteRoot` to overall data, not to each note
    .use(addFileData, { noteRoot })
    .use(addTitle)
    .use(addSlug)
    .use(addReadingTime)
}

function createRemarkPipeline({ backlinks, imgUrl, imgSavePath, noteRoot }) {
  const pipeline = createMinimalRemarkPipeline({ noteRoot })
    .data({ backlinks })
    .use(collectImgs, { imgUrl, imgSavePath })
    .use(addLinks)

  return pipeline
}

export function createRehypePipeline(config) {
  const pipeline = createRemarkPipeline(config)
    .use(remarkRehype, { allowDangerousHtml: true, passThrough: [] })
    .use(rehypeMathjax, {
      loader: { load: ['[tex]/mathtools'] },
      tex: {
        packages: { '[+]': ['ams', 'color', 'mathtools'] },
        inlineMath: [              // start/end delimiter pairs for in-line math
          ['$', '$'],
          ['\\(', '\\)'],
        ],
        displayMath: [             // start/end delimiter pairs for display math
          ['$$', '$$'],
          ['\\[', '\\]']
        ],
        processEscapes: true,
      }
    })
    .use(rehypeShiki, {
      themes: {
        dark: 'github-dark',
        light: 'github-light'
      },
      defaultColor: 'light',
      transformers: [transformerNotationHighlight()]
    })
    .use(rehypeFigure)
    .use(rehypeWrapTextElems)
    .use(rehypeRaw)
    .use(rehypeStringify)

  return pipeline
}

export function createRetextPipeline(config) {
  const pipeline = createMinimalRemarkPipeline(config)
    .use(removeFirstHeader)
    .use(stripMarkdown, { remove: ['math', 'inlineMath'] })
    .use(remarkStringify)

  return pipeline
}
