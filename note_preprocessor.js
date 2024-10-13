import path from 'path';

import { mkdir, rm, writeFile } from 'fs/promises';
import reporter from 'vfile-reporter';
import { readSync } from 'to-vfile';
import * as d3 from "d3";
import Watcher from 'watcher';
import { readdir } from 'fs/promises';
import { createRehypePipeline, createRetextPipeline, logger } from './unify_pipelines.js';


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


  const width = maxX - minX;
  const height = maxY - minY;
  const paddingFr = 0.1
  const newViewBox = [
    -width * paddingFr / 2, // min x
    -height * paddingFr / 2, // min y
    width + width * paddingFr, // width
    height + height * paddingFr // height
  ];

  return { nodes, links, viewBox: newViewBox };
}

export function computeForceSimulation(nodes, links) {
  const simulation = d3.forceSimulation(nodes)
    .alphaDecay(0.001)
    .force("link", d3.forceLink(links).strength(0.1))
    .force("charge", d3.forceManyBody().strength(-10).distanceMax(120))
    .force("center", d3.forceCenter().strength(0.5))
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


function saveJSON(path, json) {
  logger.info(`Writing out ${path}.`)
  return writeFile(
    path,
    JSON.stringify(json),
    { encoding: 'utf8' }
  )
}



export async function preprocess(config, args) {
  const processor = new NotePreprocessor(config)

  const noteRoot = args[0]
  await processor.preprocess(noteRoot)
}

class NotePreprocessor {
  constructor(config) {
    this.config = config
    this.backlinks = new Map();
    this.notes = new Map()

  }

  _generateGraphJSON() {
    const nodes = []
    for (const note of this.notes.values()) {
      const node = { ...note }
      delete node.content;
      nodes.push(node)
    }

    const slugToIdx = new Map()
    for (const [idx, note] of nodes.entries()) {
      slugToIdx.set(note.slug, idx)
    }

    const links = []
    const addedLinks = new Set()
    for (const node of nodes) {
      const fromNodeIdx = slugToIdx.get(node.slug)

      if (typeof fromNodeIdx === "undefined") continue;

      for (const link of node.links) {
        const toNodeIdx = slugToIdx.get(link.slug)
        if (typeof toNodeIdx === "undefined") continue;

        const linkId = [fromNodeIdx, toNodeIdx]
        if (addedLinks.has(linkId)) continue;

        links.push({
          source: fromNodeIdx,
          target: toNodeIdx,
        })
        addedLinks.add(linkId);
      }
    }

    return computeForceSimulation(nodes, links)
  }

  async _generateSearchJSON() {
    const filePromises = []
    for (const note of this.notes.values()) {
      filePromises.push(this.retextPipeline.process(readSync(note.originalPath)))
    }

    const searchNotes = []
    for (const file of await Promise.all(filePromises)) {
      const note = {
        content: file.value,
        title: file.data.title,
        slug: file.data.slug,
      }
      searchNotes.push(note)
    }

    return searchNotes
  }

  async _setupPaths() {
    await Promise.all([
      mkdir(this.config.savePath, { recursive: true }),
      mkdir(this.config.imgSavePath, { recursive: true })
    ])
  }

  async _lsAbsPaths(dir) {
    const relPaths = await readdir(dir, { recursive: true })
    return relPaths.map(p => path.join(dir, p))
  }


  async _updateAll(noteRoot) {
    logger.info(`Updating all entries`)
    this.notes.clear()

    const oldImages = new Set(await this._lsAbsPaths(this.config.imgSavePath));
    const oldNotes = new Set(await this._lsAbsPaths(this.config.savePath));

    const dirEntries = await readdir(noteRoot, { withFileTypes: true, recursive: true })
    const newNotePaths = []
    for (const entry of dirEntries) {
      if (entry.isFile() && path.extname(entry.name) == '.md') {
        newNotePaths.push(path.join(entry.path || entry.parentPath, entry.name))
      }
    }

    const updatedNotes = await this._update(newNotePaths)
    const newImages = new Set(updatedNotes.map(n => n.images).flat())
    const newNotes = new Set(updatedNotes.map(n => path.join(this.config.savePath, `${n.slug}.json`)))
    newNotes.add(path.join(this.config.savePath, '__graph.json'))
    newNotes.add(path.join(this.config.savePath, '__search.json'))

    const outdatedNotes = [...setDiff(oldNotes, newNotes)]
    const outdatedImgs = [...setDiff(oldImages, newImages)]

    await Promise.all(
      outdatedNotes.map(notePath => rm(notePath)).concat(
        outdatedImgs.map(imgPath => rm(imgPath))
      )
    )
  }

  _enhanceLinks(linkSlugs, noteSlug) {
    const links = []
    for (const slug of linkSlugs) {
      let note = this.notes.get(slug)
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

  async _update(notePaths) {
    const processedFiles = []
    for (const notePath of notePaths) {
      processedFiles.push(this.rehypePipeline.process(readSync(notePath)))
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

      this.notes.set(note.slug, note);
      updatedNotes.set(note.slug, note)
    }

    for (const note of this.notes.values()) {
      if ("linkSlugs" in note) {
        updatedNotes.set(note.slug, note)

        note.links = this._enhanceLinks(note.linkSlugs, note.slug)
        delete note.linkSlugs
      }
      if ("backlinkSlugs" in note) {
        updatedNotes.set(note.slug, note)

        note.backlinks = this._enhanceLinks(note.backlinkSlugs, note.slug)
        delete note.backlinkSlugs
      }
    }

    const writePromises = []

    if (updatedNotes.size > 0) {
      const graphJSON = this._generateGraphJSON()
      const graphDestPath = path.join(this.config.savePath, "__graph.json")
      writePromises.push(saveJSON(graphDestPath, graphJSON))

      const searchJSON = await this._generateSearchJSON()
      const searchDestPath = path.join(this.config.savePath, "__search.json")
      writePromises.push(saveJSON(searchDestPath, searchJSON))
    }

    for (const note of updatedNotes.values()) {
      writePromises.push(saveJSON(path.join(this.config.savePath, `${note.slug}.json`), note))
    }

    await Promise.all(writePromises)

    return [...updatedNotes.values()]
  }

  async preprocess(noteRoot) {
    this.rehypePipeline = createRehypePipeline(this, noteRoot)
    this.retextPipeline = createRetextPipeline(this, noteRoot)

    logger.info(`Processing notes in ${noteRoot}`)

    await this._setupPaths()

    await this._updateAll(noteRoot)

    if (this.config.watch) {
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
          this._update([targetPath])
          return
        }

        this._updateAll(noteRoot)
      })
    }
  }
}
