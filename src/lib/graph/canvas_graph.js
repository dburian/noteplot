import { goto } from "$app/navigation";
import * as d3 from "d3";
/** @type {import('tailwindcss').Config} */
import tailwindConfig from "virtual:tailwind-config";
const tailwindColors = tailwindConfig.theme.colors


function dist(p1, p2) {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2
  )
}

/**
  * @typedef {{x_shift: Number, y_shift: Number, type: string}} GlowPixel
  * @typedef {{source: Node, target: Node}} Link
  * @typedef {{tags: Array<string>}} FrontMatter
  * @typedef {{slug: string, title: string, x: Number, y: Number, matter: FrontMatter}} Node
  * @typedef {{
    * activeNote: import("$lib/search/search_index").Note,
    * hoveredNote: import("$lib/search/search_index").Note,
    * showConnections: boolean,
    * showTagsGlow: boolean,
    }} GraphState
  * @typedef {{
    * hover: (node: Node) => null;
  * } & import("svelte/store").Writable<GraphState>} GraphStateStore
  * @typedef {{
    * query: import("minisearch").Query,
    * results: import("$lib/search/search_index").Match[],
  * }} FilterState
  * @typedef {import("svelte/store").Writable<FilterState>} FilterStateStore
  */

/**
  * Sample Normal distribution with unit mean and unit variance using the
  * Box–Muller transform.
  *
  * @returns {Number}
  */
function sample_normal() {
  const u1 = 1 - Math.random()
  const u2 = 1 - Math.random()

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

class GraphRenderer {
  constructor(redrawFn) {
    this.theme = {
      nodeWidth: 10,
      foreground: '#0f172a',
      background: '#ffffff',
      highlight: "#000",
      darkMode: false,
      glowPixelWidth: 3,
      glowPixelGap: 0.5,
      numGlowPixels: 20,
    }

    this.redraw = redrawFn

    const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
    this.setDarkMode(darkModePreference.matches)
    darkModePreference.addEventListener("change", this.onDarkMode);
  }


  /**
   * @param {MediaQueryListEvent} event */
  onDarkMode = (event) => {
    this.setDarkMode(event.matches)

    this.redraw()
  }

  /**
    * @param {boolean} darkModeOn */
  setDarkMode(darkModeOn) {
    if (darkModeOn) {
      this.theme.foreground = tailwindColors.front.dark;
      this.theme.background = tailwindColors.back.dark;
      this.theme.highlight = tailwindColors.emphasis.dark;
    } else {
      this.theme.foreground = tailwindColors.text.light;
      this.theme.background = tailwindColors.back.light;
      this.theme.highlight = tailwindColors.emphasis.light;
    }

    this.theme.darkMode = darkModeOn
  }

  /**
    * @param {Map<String, Node>} nodes
    * @param {Map<String, Map<String, Link>>} links
    * @param {{pixels: Map<String,GlowPixel[]>, hues: Map<String, number>}} glow
    * @param {CanvasScreen} screen
    * @param {GraphState} state
    *
    */
  draw(nodes, links, glow, screen, state) {
    const ctx = screen.ctx
    ctx.resetTransform()
    ctx.scale(screen.dpr, screen.dpr)

    ctx.clearRect(0, 0, screen.width, screen.height)

    /** @param {Node} node */
    const isHovered = (node) => node.slug == state.hoveredNote?.slug
    /** @param {Node} node */
    const isSelected = (node) => node.slug == state.activeNote?.slug

    if (state.showTagsGlow) {
      const hues = glow.hues
      for (const node of nodes.values()) {
        const pixels = glow.pixels.get(node.slug)
        if (pixels) {
          this.drawNodeGlow(pixels, hues, node, screen)
        }
      }
    }

    if (state.showConnections) {
      for (const byTarget of links.values()) {
        for (const link of byTarget.values()) {
          this.drawLink(link, screen)
        }
      }
    }

    for (const node of nodes.values()) {
      this.drawNode(
        node,
        screen,
        isHovered(node),
        isSelected(node)
      )
    }

    if (screen.transform.k > 2) {
      for (const node of nodes.values()) {
        this.drawNodeLabel(
          node,
          screen,
          isHovered(node),
          isSelected(node)
        )
      }
    }

    // Redraw selected/hovered nodes so they end up on the top
    for (const note of [state.activeNote, state.hoveredNote]) {
      const node = nodes.get(note?.slug)
      if (!node) continue

      this.drawNode(node, screen, isHovered(node), isSelected(node))
      this.drawNodeLabel(node, screen, isHovered(node), isSelected(node))
    }
  }

  /**
    * @param {Node} node
    * @param {CanvasScreen} screen 
    * @param {boolean} hovered 
    * @param {boolean} selected 
    */
  drawNodeLabel(node, screen, hovered, selected) {
    const { x, y } = screen.toScreenPos(node)

    const ctx = screen.ctx
    ctx.textBaseline = "middle";
    ctx.strokeStyle = this.theme.background;
    ctx.fillStyle = this.theme.foreground;
    ctx.lineWidth = 4;
    let fontSize = 12;
    let nW = this.theme.nodeWidth;

    if (hovered || selected) {
      fontSize *= 1.3
      nW *= 1.8
      ctx.fillStyle = this.theme.highlight
    }
    ctx.font = `${fontSize}px sans-serif`;

    ctx.strokeText(node.title, x + nW, y);
    ctx.fillText(node.title, x + nW, y)
  }

  /**
    * @param {Node} node
    * @param {CanvasScreen} screen
    */
  drawNode(node, screen, hovered = false, selected = false) {
    const { x, y } = screen.toScreenPos(node)
    let nW = this.theme.nodeWidth
    const ctx = screen.ctx;
    ctx.strokeStyle = this.theme.foreground

    if (hovered || selected) {
      nW *= 2
      ctx.strokeStyle = this.theme.highlight
    }

    if (selected) {
      ctx.fillStyle = this.theme.highlight;
      ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
    } else {
      ctx.fillStyle = this.theme.background
      ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
      ctx.lineWidth = 1
      ctx.strokeRect(x - nW / 2, y - nW / 2, nW, nW)
    }
  }

  /**
    * @param {Link} link
    * @param {CanvasScreen} screen 
    */
  drawLink(link, screen) {
    const { x: sourceX, y: sourceY } = screen.toScreenPos(link.source)
    const { x: targetX, y: targetY } = screen.toScreenPos(link.target)

    const ctx = screen.ctx
    ctx.beginPath()
    ctx.strokeStyle = this.theme.foreground;
    ctx.lineWidth = 1
    ctx.moveTo(sourceX, sourceY)
    ctx.lineTo(targetX, targetY)
    ctx.stroke()
    ctx.closePath()
  }

  /**
    * @param {GlowPixel[]} pixels
    * @param {Map<String, number>} hues 
    * @param {Node} node
    * @param {CanvasScreen} screen 
    */
  drawNodeGlow(pixels, hues, node, screen) {
    const { x, y } = screen.toScreenPos(node)
    const gpw = this.theme.glowPixelWidth * screen.transform.k
    const gpg = this.theme.glowPixelGap * screen.transform.k
    const saturation = this.theme.darkMode ? 50 : 30;

    const ctx = screen.ctx

    for (const pixel of pixels) {
      const hue = hues.get(pixel.type)
      const hslStr = `hsla(${hue}, ${saturation}%, 50%, 0.4)`
      const glowColor = d3.color(hslStr)?.formatHex()

      const pixelX = x + (pixel.x_shift * (gpw + gpg))
      const pixelY = y + (pixel.y_shift * (gpw + gpg))

      ctx.fillStyle = glowColor
      ctx.fillRect(pixelX, pixelY, gpw, gpw)
    }
  }
}

class CanvasScreen {
  constructor(viewBox, canvas, redrawFn) {
    this.viewBox = {
      minX: viewBox[0],
      minY: viewBox[1],
      width: viewBox[2],
      height: viewBox[3],
    }
    this.transform = {
      x: 0,
      y: 0,
      k: 1,
    }
    this.redraw = redrawFn

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    window.addEventListener("resize", this.onResize)

    // Just to convince LS these properties exist
    this.width = 0
    this.height = 0
    this.dpr = 1
    this.updateCanvasSize()

    // Just to convince LS these properties exist
    this.paintBox = {
      minX: 0,
      minY: 0,
      width: 0,
      height: 0,
    }
    this.updatePaintBox()
    this.addZoom()
  }

  destruct() {
    window.removeEventListener("resize", this.onResize)
  }

  addZoom() {
    const zoomBehavior = d3.zoom()
      .on("zoom", this.onZoom)
    d3.select(this.canvas).call(zoomBehavior)
  }

  onZoom = (event) => {
    this.transform = event.transform
    this.redraw()
  }

  onResize = () => {
    this.updateCanvasSize()
    this.updatePaintBox()
    this.redraw()
  }

  updateCanvasSize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.dpr = window.devicePixelRatio

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
  }

  updatePaintBox() {
    const viewBoxAR = this.viewBox.width / this.viewBox.height
    const trueAR = this.width / this.height

    const paintBox = { minX: 0, minY: 0, width: 0, height: 0 }
    if (viewBoxAR > trueAR) {
      //True is less width or more height -> we enlarge width and center height

      paintBox.width = this.width
      paintBox.height = this.width / viewBoxAR;
      paintBox.minY = (this.height - paintBox.height) / 2
    } else {
      paintBox.height = this.height
      paintBox.width = this.height * viewBoxAR;
      paintBox.minX = (this.width - paintBox.width) / 2
    }


    this.paintBox = paintBox;
  }

  /**
    * @param {{x: Number, y: Number}} viewBoxPos */
  toScreenPos(viewBoxPos) {
    const normX = (viewBoxPos.x - this.viewBox.minX) / this.viewBox.width
    const normY = (viewBoxPos.y - this.viewBox.minY) / this.viewBox.height
    const screenX = this.paintBox.minX + normX * this.paintBox.width
    const screenY = this.paintBox.minY + normY * this.paintBox.height

    return {
      x: screenX * this.transform.k + this.transform.x,
      y: screenY * this.transform.k + this.transform.y
    }
  }

  /**
    * Turns screen position into viewbox position.
    * @param {{x: Number, y: Number}} screenPos
    *
    * @returns {{x: Number, y: Number}} */
  toViewBoxPos(screenPos) {
    const screenX = (screenPos.x - this.transform.x) / this.transform.k
    const screenY = (screenPos.y - this.transform.y) / this.transform.k

    const normX = (screenX - this.paintBox.minX) / this.paintBox.width
    const normY = (screenY - this.paintBox.minY) / this.paintBox.height

    const viewBoxX = normX * this.viewBox.width + this.viewBox.minX
    const viewBoxY = normY * this.viewBox.height + this.viewBox.minY

    return { x: viewBoxX, y: viewBoxY }
  }
}


const EMPTY_MAP = new Map()

export class CanvasGraph {
  /**
    * @param {Array<Node>} nodes
    * @param {Array<Link>} links
    * @param {GraphStateStore} graphStateStore
    * @param {FilterStateStore} filterStore
    *
    */
  constructor(
    nodes,
    links,
    viewBox,
    canvas,
    graphStateStore,
    filterStore,
  ) {
    this.nodes = new Map();
    this.links = new Map()
    for (const node of nodes) this.nodes.set(node.slug, node)
    for (const link of links) {
      if (!this.links.has(link.source.slug)) {
        this.links.set(link.source.slug, new Map())
      }
      this.links.get(link.source.slug).set(link.target.slug, link)
    }

    this.renderer = new GraphRenderer(this.draw)
    this.screen = new CanvasScreen(viewBox, canvas, this.draw)

    this.grid = this.constructGrid()
    this.fillGrid()

    canvas.addEventListener("click", this.onClick)
    canvas.addEventListener("mousemove", this.onHover)
    this.glow = this.generateGlow()

    this.deferDraw = true

    /** @type {GraphState} */
    this.graphState;
    this.graphStateStore = graphStateStore
    this.graphStateUnsubscribe = graphStateStore.subscribe(this.onGraphStateChange)


    this.filteredNodes = this.nodes
    this.filteredLinks = this.links
    this.filterStore = filterStore
    this.filterUnsubscribe = filterStore.subscribe(this.onFilterChange)

    this.deferDraw = false
    this.draw()
  }


  destruct() {
    this.screen.canvas.removeEventListener("click", this.onClick)
    this.screen.canvas.removeEventListener("mousemove", this.onHover)
    this.screen.destruct()
    this.graphStateUnsubscribe()
    this.filterUnsubscribe()
  }

  /**
    * @param {GraphState} newState
  */
  onGraphStateChange = (newState) => {
    if (this.graphState !== newState) {
      this.graphState = newState
      this.draw()
    }
  }

  /**
    * @param {FilterState} newFilter
    */
  onFilterChange = (newFilter) => {
    // TODO: If query changed, only then filter
    this.filteredNodes = this.nodes
    this.filteredLinks = this.links

    if (newFilter.results) {
      this.filteredNodes = new Map()
      this.filteredLinks = new Map()

      for (const match of newFilter.results) {
        this.filteredNodes.set(match.note.slug, this.nodes.get(match.note.slug))
      }

      /** @param {Link} link */
      const addLink = (link) => {
        if (!this.filteredLinks.has(link.source.slug)) {
          this.filteredLinks.set(link.source.slug, new Map())
        }
        this.filteredLinks.get(link.source.slug).set(link.target.slug, link)
      }

      for (const slug of this.filteredNodes.keys()) {
        if (!this.links.has(slug)) continue

        for (const targetSlug of this.links.get(slug).keys()) {
          if (this.filteredNodes.has(targetSlug)) {
            addLink(this.links.get(slug).get(targetSlug))
          }
        }
      }
    }

    this.draw()
  }

  /**
    *
    * @returns {{
    *   rows: Array<Array<Array<Node>>>,
    *   numRows: Number,
    *   numCols: Number,
    *   cellSize: Number
    * }}
    */
  constructGrid() {
    const viewBox = this.screen.viewBox
    const gridSize = Math.min(viewBox.width / 5, viewBox.height / 5)
    const numRows = Math.ceil(viewBox.height / gridSize)
    const numCols = Math.ceil(viewBox.width / gridSize)

    /** @type Array<Array<Array<Node>>> */
    const rows = []
    for (const _ of Array(numRows)) {
      /** @type Array<Array<Node>> */
      const cols = []
      for (const _ of Array(numCols)) {
        cols.push([])
      }
      rows.push(cols)
    }

    return {
      rows: rows,
      cellSize: gridSize,
      numCols,
      numRows,
    }
  }

  fillGrid() {
    for (const node of this.nodes.values()) {
      const { col, row } = this.toGridIdxs(node)
      this.grid.rows[row][col].push(node)
    }
  }

  /**
    * Generates glow pixels for each node. Glow is a pixelated 'hue' around
    * each node signilizing its type.
    *
    * @returns {{
    *   pixels: Map<string, GlowPixel[]>
    *   hues: Map<string, Number>,
    * }}
    */
  generateGlow() {
    const types = new Set()

    /**
      * @type {Map<string, Array<GlowPixel>>}
      */
    const pixels = new Map()

    for (const node of this.nodes.values()) {
      const nodeTypes = node.matter.tags || []
      // No glow for nodes without type
      if (nodeTypes.length == 0) {
        continue;
      }
      pixels.set(node.slug, [])

      const glowPixesPerType = Math.ceil(this.renderer.theme.numGlowPixels / nodeTypes.length)
      for (const type of nodeTypes) {
        types.add(type)

        for (const _ of Array(glowPixesPerType)) {
          const x_shift = Math.floor(sample_normal() * 5)
          const y_shift = Math.floor(sample_normal() * 5)

          pixels.get(node.slug).push({ x_shift: x_shift, y_shift: y_shift, type })
        }
      }
    }

    const hues = new Map()
    let lastHue = 0
    const hueStep = 360 / types.size
    for (const type of types) {
      hues.set(type, lastHue)
      lastHue += hueStep
    }

    return { pixels, hues }
  }

  /**
    * @param {UIEvent} event */
  onClick = (event) => {
    const node = this.getNode({ x: event.clientX, y: event.clientY })

    if (node && this.filteredNodes.has(node.slug)) {
      // TODO: Replace by actual `activate` function on graph state
      goto(`/${node.slug}`)
    }
  }

  /**
    * @param {AbortSignalEventMap} event */
  onHover = (event) => {
    // Disable hover events on mobile
    if (event.sourceCapabilities.firesTouchEvents) return

    const node = this.getNode({ x: event.clientX, y: event.clientY })

    if (node && this.filteredNodes.has(node.slug)) {
      this.graphStateStore.hover(node)
      document.body.style = "cursor: pointer;";
    } else if (!node && this.graphState.hoveredNote !== null) {
      this.graphStateStore.hover(null)
      document.body.style = "cursor: default;";
    }
  }

  draw = () => {
    if (this.deferDraw) return

    this.renderer.draw(
      this.filteredNodes,
      this.filteredLinks,
      this.glow,
      this.screen,
      this.graphState,
    )
  }

  getNode(screenPos) {
    const viewBoxPos = this.screen.toViewBoxPos(screenPos)
    const gridCoords = this.toGridIdxs(viewBoxPos)
    if (
      gridCoords.row < 0 ||
      gridCoords.col < 0 ||
      gridCoords.row >= this.grid?.numRows ||
      gridCoords.col >= this.grid?.numCols
    ) {
      return null
    }

    const gridItems = this.grid.rows[gridCoords.row][gridCoords.col]

    if (gridItems.length == 0) return null;

    const eps = 10 * this.screen.dpr
    for (const node of gridItems) {
      const nodeDist = dist(this.screen.toScreenPos(node), screenPos)
      if (nodeDist < eps) {
        return node
      }
    }

    return null
  }

  /**
    * Turns viewbox position into grid indicies.
    * @param {{x: Number, y: Number}} viewBoxPos
    *
    * @returns {{col: Number, row: Number}}
    */
  toGridIdxs(viewBoxPos) {
    return {
      col: Math.floor((viewBoxPos.x - this.screen.viewBox.minX) / this.grid.cellSize),
      row: Math.floor((viewBoxPos.y - this.screen.viewBox.minY) / this.grid.cellSize),
    }
  }
}


