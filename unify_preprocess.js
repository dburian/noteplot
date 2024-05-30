import remarkFrontmatter from 'remark-frontmatter';
import { visit, EXIT, SKIP, CONTINUE } from 'unist-util-visit';
import path from 'path';

import inlineLinks from 'remark-inline-links';
import { copyFile, mkdir, rm, writeFile } from 'fs/promises';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { rehypeShiki } from '@astrojs/markdown-remark'
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import reporter from 'vfile-reporter';
import { readSync } from 'to-vfile';
import * as d3 from "d3";
import Watcher from 'watcher';
import pino from 'pino';
import { readdir } from 'fs/promises';
import { inspect } from 'util';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
})

function shrinkViewBox(nodes, links) {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minY = Math.min(node.y, minY);
    maxY = Math.max(node.y, maxY);
    minX = Math.min(node.x, minX);
    maxX = Math.max(node.x, maxX);
  }

  const moveNode = (node) => ({ ...node, x: node.x - minX, y: node.y - minY })
  nodes = nodes.map(moveNode);
  links = links.map(link => ({
    ...link,
    source: moveNode(link.source),
    target: moveNode(link.target)
  }));


  const newViewBox = [0, 0, maxX - minX, maxY - minY];
  return { nodes, links, viewBox: newViewBox };
}

export function computeForceSimulation(nodes, links) {
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).strength(1))
    .force("charge", d3.forceManyBody().distanceMax(120))
    .force("center", d3.forceCenter())
    .stop()

  const numberOfTicksTillEnd = Math.ceil(
    Math.log(simulation.alphaMin()) /
    Math.log(1 - simulation.alphaDecay())
  )
  for (let i = 0; i < numberOfTicksTillEnd; ++i) {
    simulation.tick();
  }

  return shrinkViewBox(nodes, links)
}

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

function setDiff(set1, set2) {
  if ('difference' in set1) {
    return set1.difference(set2)
  }

  const diff = new Set();
  for (const elem of set1) {
    if (!set2.has(elem)) {
      diff.add(elem)
    }
  }

  return diff
}

export async function preprocess(config, args) {
  const noteRoot = args[0]
  logger.info(`Processing notes in ${noteRoot}`)

  await Promise.all([
    mkdir(config.savePath, { recursive: true }),
    mkdir(config.imgSavePath, { recursive: true })
  ])

  const backlinks = new Map();

  const processor = unified()
    .data({backlinks})
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(inlineLinks)
    .use(addFileData, { noteRoot })
    .use(collectImgs, { ...config })
    .use(addTitle)
    .use(addSlug)
    .use(addLinks)
    .use(addBacklinks)
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
    .use(rehypeShiki, { langs: [], theme: 'github-light', themes: {}, wrap: false, transformers: [] })
    .use(rehypeRaw)
    .use(rehypeStringify)

  const notes = new Map()

  function enhanceLinks(linkSlugs, noteSlug) {
    const links = []
    for (const slug of linkSlugs) {
      let note = notes.get(slug)
      if (typeof note === "undefined") {
        logger.warn(`Link to unknown note: ${slug} from note ${noteSlug}.`)
        note = {
          title: 'Unknown',
        }
      }

      links.push({
        slug,
        title: note.title
      })
    }

    return links;
  }

  function saveJSON(path, json) {
    logger.info(`Writing out ${path}.`)
    return writeFile(
      path,
      JSON.stringify(json),
      { encoding: 'utf8' }
    )
  }

  function generateGraphJSON() {
    const nodes = []
    for (const note of notes.values()) {
      const node = { ...note }
      delete node.content;
      nodes.push(node)
    }

    const slugToIdx = new Map()
    for (const [idx, note] of nodes.entries()) {
      slugToIdx.set(note.slug, idx)
    }

    const links = []
    for (const node of nodes) {
      const fromNodeIdx = slugToIdx.get(node.slug)

      if (typeof fromNodeIdx === "undefined") continue;

      for (const link of node.links) {
        const toNodeIdx = slugToIdx.get(link.slug)

        if (typeof toNodeIdx === "undefined") continue;
        links.push({
          source: fromNodeIdx,
          target: toNodeIdx,
        })
      }
    }

    return computeForceSimulation(nodes, links)
  }

  async function update(notePaths) {
    const processedFiles = []
    for (const notePath of notePaths) {
      processedFiles.push(processor.process(readSync(notePath)))
    }

    const updatedNotes = new Map()
    for (const file of await Promise.all(processedFiles)) {
      const report = reporter(file, { silent: true })
      if (report) logger.error(report)

      const note = { ...file.data };
      note.content = file.value

      if (typeof note.images === 'undefined') {
        logger.error(note, 'No images')
      }

      notes.set(note.slug, note);
      updatedNotes.set(note.slug, note)
    }

    for (const note of notes.values()) {
      if ("linkSlugs" in note) {
        updatedNotes.set(note.slug, note)

        note.links = enhanceLinks(note.linkSlugs, note.slug)
        delete note.linkSlugs
      }
      if ("backlinkSlugs" in note) {
        updatedNotes.set(note.slug, note)

        note.backlinks = enhanceLinks(note.backlinkSlugs, note.slug)
        delete note.backlinkSlugs
      }
    }

    const writePromises = []

    if (updatedNotes.size > 0) {
      const graphJSON = generateGraphJSON()
      const graphDestPath = path.join(config.savePath, "__graph.json")
      writePromises.push(saveJSON(graphDestPath, graphJSON))
    }

    for (const note of updatedNotes.values()) {
      writePromises.push(saveJSON(path.join(config.savePath, `${note.slug}.json`), note))
    }

    await Promise.all(writePromises)

    return [...updatedNotes.values()]
  }

  async function updateAll() {
    logger.info(`Updating all entries`)
    notes.clear()

    const lsAbsPaths = async (dir) => {
      const relPaths = await readdir(dir, {recursive: true})
      return relPaths.map(p => path.join(dir, p))
    }
    const oldImages = new Set(await lsAbsPaths(config.imgSavePath));
    const oldNotes = new Set(await lsAbsPaths(config.savePath));

    const dirEntries = await readdir(noteRoot, { withFileTypes: true, recursive: true })
    const newNotePaths = []
    for (const entry of dirEntries) {
      if (entry.isFile() && path.extname(entry.name) == '.md') {
        newNotePaths.push(path.join(entry.path || entry.parentPath, entry.name))
      }
    }

    const updatedNotes = await update(newNotePaths)
    const newImages = new Set(updatedNotes.map(n => n.images).flat())
    const newNotes = new Set(updatedNotes.map(n => path.join(config.savePath, `${n.slug}.json`)))
    newNotes.add(path.join(config.savePath, '__graph.json'))

    const outdatedNotes = [...setDiff(oldNotes, newNotes)]
    const outdatedImgs = [...setDiff(oldImages, newImages)]

    await Promise.all(
      outdatedNotes.map(notePath => rm(notePath)).concat(
        outdatedImgs.map(imgPath => rm(imgPath))
      )
    )
  }

  await updateAll()


  if (config.watch) {
    logger.info("Watching for changes...")

    const ignoreFn = (absPath) => {
      const relPath = path.relative(noteRoot, absPath)

      if (/^\./.test(relPath)) {
        logger.debug(`${absPath} starts with a dot. Ignoring...`)
        return true;
      }

      return false;
    }

    const watcher = new Watcher(noteRoot, { recursive: true, ignoreInitial: true, ignore: ignoreFn })

    const actionableEvents = new Set([
      'add', // new note
      'unlink', // deleted note
      'change', // change content of the note
    ])
    watcher.on("all", (eventType, targetPath) => {
      if (!actionableEvents.has(eventType)) return
      logger.debug(`Event ${eventType} fired on ${targetPath}`)

      if (eventType == 'change') {
        update([targetPath])
        return
      }

      updateAll()
    })
  }
}

