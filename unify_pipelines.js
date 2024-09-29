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
import remarkRetext from 'remark-retext';
import { inspect } from 'util';
import rehypeShiki from '@shikijs/rehype';
import path from 'path';
import retextLatin from 'retext-latin';
import retextStringify from 'retext-stringify';
import stripMarkdown from 'strip-markdown';
import remarkStringify from 'remark-stringify';

function isURL(str) {
  try {
    return Boolean(new URL(str));
  } catch (e) {
    return false;
  }

}

function toSlug(fullFilePath, sourceRoot, { withExtension } = { withExtension: false }) {
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

function collectImgs({ imgUrl, imgSavePath }) {
  return (tree, file) => {
    const fileImgs = [];
    visit(tree, 'image', async node => {
      if (isURL(node.url)) return SKIP;

      const absolutePath = path.resolve(file.dirname, node.url)
      const imgSlug = toSlug(absolutePath, file.data.noteRoot, { withExtension: true })
      node.url = path.join(imgUrl, imgSlug)

      const destPath = path.join(imgSavePath, imgSlug)
      await copyFile(absolutePath, destPath)

      fileImgs.push(destPath)
      return CONTINUE;
    })

    file.data.images = fileImgs;
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
      file.data.title = node.children[0].value

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
    const links = []

    visit(tree, 'link', (node) => {
      if (isURL(node.url)) return SKIP;

      const linkDest = path.resolve(file.dirname, node.url);
      const slugLinkDest = toSlug(linkDest, file.data.noteRoot);
      node.url = slugLinkDest;

      links.push(slugLinkDest);

      if (!backlinks.has(slugLinkDest)) {
        backlinks.set(slugLinkDest, new Set());
      }

      backlinks.get(slugLinkDest).add(file.data.slug);
    });

    file.data.linkSlugs = links;
  };
}

function addBacklinks() {
  const backlinks = this.data().backlinks

  return (_, file) => {
    file.data.backlinkSlugs = [...backlinks.get(file.data.slug) || []]
  };
}

function printFile() {
  return async (tree, file) => {
    if (file.stem == 'pca') {
      logger.debug(file);
    }
  };
}

function printTree() {
  return async (tree, file) => {
    if (file.stem == 'pca') {
      logger.debug(file.path)
      logger.debug(inspect(tree), depth = 100);
    }
  };
}

function createRemarkPipeline(preprocessor, noteRoot) {
  const pipeline = unified()
    .data({ backlinks: preprocessor.backlinks })
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(inlineLinks)
    .use(addFileData, { noteRoot })
    .use(collectImgs, { ...preprocessor.config })
    .use(addTitle)
    .use(addSlug)
    .use(addLinks)
    .use(addBacklinks)

  return pipeline
}

export function createRehypePipeline(preprocessor, noteRoot) {
  const pipeline = createRemarkPipeline(preprocessor, noteRoot)
    .use(remarkRehype, { allowDangerousHtml: true, passThrough: [] })
    .use(rehypeMathjax, {
      tex: {
        packages: { '[+]': ['ams'] },
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
    })
    .use(rehypeRaw)
    .use(rehypeStringify)

  return pipeline
}

export function createRetextPipeline(preprocessor, noteRoot) {
  const pipeline = createRemarkPipeline(preprocessor, noteRoot)
    .use(stripMarkdown)
    .use(remarkStringify)
  //.use(remarkRetext, unified().use(retextLatin), {ignore: ['image']})
  //.use(retextStringify)

  return pipeline
}
