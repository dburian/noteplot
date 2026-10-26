import { VFile } from 'vfile';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import inlineLinks from 'remark-inline-links';
import remarkRehype from 'remark-rehype';
import rehypeMathjax from 'rehype-mathjax';
import rehypeShiki from '@shikijs/rehype';
import { transformerNotationHighlight } from '@shikijs/transformers';
import rehypeFigure from '@microflash/rehype-figure';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import stripMarkdown from 'strip-markdown';
import remarkStringify from 'remark-stringify';
import reporter from 'vfile-reporter';

import { toDisplayPath } from '../slug.js';
import {
  addCreated,
  addFrontmatter,
  addLinks,
  addReadingTime,
  addSlug,
  addTitle,
  collectImgs,
  rehypeWrapTextElems,
  removeFirstHeader
} from './plugins.js';

/**
 * Builds the parser once -- MathJax and Shiki are expensive to set up, so a
 * worker builds it at start and reuses it for every note it is handed.
 *
 * A note is parsed **once**. The Markdown tree is then cloned into two
 * branches: one renders HTML for the note's page, the other strips it to the
 * plaintext the search index (and any content-derived graph) reads. The search
 * index used to read and parse every file a second time to get that.
 *
 * @param {{noteRoot: string, imgUrl: string}} config
 */
export function createParser({ noteRoot, imgUrl }) {
  const markdown = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(addFrontmatter)
    .use(addCreated)
    .use(remarkMath)
    .use(inlineLinks)
    .use(addTitle)
    .use(addSlug, { noteRoot })
    .use(addReadingTime)
    .use(collectImgs, { imgUrl, noteRoot })
    .use(addLinks, { noteRoot });

  const html = unified()
    .use(remarkRehype, { allowDangerousHtml: true, passThrough: [] })
    .use(rehypeMathjax, {
      loader: { load: ['[tex]/mathtools'] },
      tex: {
        packages: { '[+]': ['ams', 'color', 'mathtools'] },
        inlineMath: [
          // start/end delimiter pairs for in-line math
          ['$', '$'],
          ['\\(', '\\)']
        ],
        displayMath: [
          // start/end delimiter pairs for display math
          ['$$', '$$'],
          ['\\[', '\\]']
        ],
        processEscapes: true
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
    .use(rehypeStringify);

  // The syntax extensions again, for their *serialising* half: without them
  // `remark-stringify` does not know how to write a table or a math node back
  // out. They add no transforms, so this does not parse anything twice.
  const text = unified()
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(removeFirstHeader)
    .use(stripMarkdown, { remove: ['math', 'inlineMath'] })
    .use(remarkStringify);

  /**
   * @param {string} absPath
   * @param {string} source the file's contents
   * @returns {Promise<{record: import('../types.js').NoteRecord, warnings: string[]}>}
   */
  return async function parseNote(absPath, source) {
    const file = new VFile({ path: absPath, value: source });

    const tree = await markdown.run(markdown.parse(file), file);

    // The HTML branch mutates its tree on the way to hast, so it gets a copy
    // and the text branch takes the original.
    const htmlTree = await html.run(structuredClone(tree), file);
    const renderedHtml = String(html.stringify(htmlTree, file));

    const textTree = await text.run(tree, file);
    const plaintext = String(text.stringify(textTree, file));

    const warnings = /** @type {string[]} */ (file.data.warnings ?? []);
    const report = reporter(file, { silent: true });
    if (report) warnings.push(report);

    const data = /** @type {any} */ (file.data);
    return {
      record: {
        slug: data.slug,
        path: toDisplayPath(absPath, noteRoot),
        noteRoot,
        originalPath: absPath,
        title: data.title,
        matter: data.matter,
        created: data.created,
        readingTime: data.readingTime,
        linkSlugs: data.linkSlugs,
        images: data.images,
        html: renderedHtml,
        text: plaintext
      },
      warnings
    };
  };
}
