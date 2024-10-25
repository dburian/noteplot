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
  * @typedef {{slug: string, title: string, x: Number, y: Number, matter: FrontMatter}} Node */

export class CanvasGraph {
  /**
    * @param {Array<Node>} nodes
    * @param {Array<Link>} links 
    */
  constructor(nodes, links, viewBox, canvas, onNodeClick, onNodeHover) {
    this.nodes = new Map();
    for (const node of nodes) this.nodes.set(node.slug, node)

    this.links = links;
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
    this.grid = this.constructGrid()
    this.fillGrid()

    this.onNodeClick = onNodeClick;
    this.onNodeHover = onNodeHover
    this.hoveredNode = null;

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')


    window.addEventListener("resize", this.onResize)
    canvas.addEventListener("click", this.onClick)
    canvas.addEventListener("mousemove", this.onHover)

    const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
    this.setDarkMode(darkModePreference.matches)
    darkModePreference.addEventListener("change", this.onDarkMode);

    // Just to convince LS CanvasGraph has this properties.
    this.width = 0
    this.height = 0

    this.updateCanvasSize()
    this.updatePaintBox()
    this.addZoom()

    this.glow = this.generateGlow()

    this.draw()
  }


  destruct() {
    window.removeEventListener("resize", this.onResize)
    this.canvas.removeEventListener("click", this.onClick)
    this.canvas.removeEventListener("mousemove", this.onHover)
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
    const gridSize = Math.min(this.viewBox.width / 5, this.viewBox.height / 5)
    const numRows = Math.ceil(this.viewBox.height / gridSize)
    const numCols = Math.ceil(this.viewBox.width / gridSize)

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

      const glowPixesPerType = Math.ceil(this.theme.numGlowPixels / nodeTypes.length)
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

  addZoom() {
    const zoomBehavior = d3.zoom()
      .on("zoom", this.onZoom)
    d3.select(this.canvas).call(zoomBehavior)
  }

  onZoom = (event) => {
    this.transform = event.transform
    this.draw()
  }

  onResize = () => {
    this.updateCanvasSize()
    this.updatePaintBox()
    this.draw()
  }

  /**
    * @param {UIEvent} event */
  onClick = (event) => {
    const node = this.getNode({ x: event.clientX, y: event.clientY })

    if (node) {
      this.onNodeClick(node)
    }
  }

  /**
    * @param {AbortSignalEventMap} event */
  onHover = (event) => {
    // Disable hover events on mobile
    if (event.sourceCapabilities.firesTouchEvents) return

    const node = this.getNode({ x: event.clientX, y: event.clientY })

    if (node) {
      this.hoveredNode = node
      document.body.style = "cursor: pointer;";
      this.draw()
    } else if (this.hoveredNode !== null) {
      this.hoveredNode = null
      document.body.style = "cursor: default;";
      this.draw()
    }

    this.onNodeHover(this.hoveredNode)
  }

  /**
   * @param {MediaQueryListEvent} event */
  onDarkMode = (event) => {
    this.setDarkMode(event.matches)

    this.draw()
  }

  updateCanvasSize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

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
    * @param {string} slug */
  selectNode(slug) {
    this.selectedNode = slug ? this.nodes.get(slug) : null;
    this.draw()
  }

  /**
    * @param {string} slug
    */
  hoverNode(slug) {
    console.log(`graph hovering ${slug}`)
    this.hoveredNode = slug ? this.nodes.get(slug) : null;
    this.draw();
  }


  draw() {
    this.ctx.resetTransform()
    this.ctx.scale(this.dpr, this.dpr)

    this.ctx.clearRect(0, 0, this.width, this.height)

    for (const node of this.nodes.values()) {
      this.drawNodeGlow(node)
    }

    for (const link of this.links) {
      this.drawLink(link)
    }

    for (const node of this.nodes.values()) {
      this.drawNode(node)
    }

    if (this.transform.k > 2) {
      for (const node of this.nodes.values()) {
        this.drawNodeLabel(node)
      }
    }

    // Redraw selected/hovered nodes so they end up on the top
    for (const node of [this.selectedNode, this.hoveredNode]) {
      if (!node) continue

      this.drawNode(node)
      this.drawNodeLabel(node)
    }
  }

  getNode(screenPos) {
    const viewBoxPos = this.toViewBoxPos(screenPos)
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

    const eps = 10 * this.dpr
    for (const node of gridItems) {
      const nodeDist = dist(this.toScreenPos(node), screenPos)
      if (nodeDist < eps) {
        return node
      }
    }

    return null
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

  /**
    * Turns viewbox position into grid indicies.
    * @param {{x: Number, y: Number}} viewBoxPos
    *
    * @returns {{col: Number, row: Number}}
    */
  toGridIdxs(viewBoxPos) {
    return {
      col: Math.floor((viewBoxPos.x - this.viewBox.minX) / this.grid.cellSize),
      row: Math.floor((viewBoxPos.y - this.viewBox.minY) / this.grid.cellSize),
    }
  }

  /**
    * @param {Node} node */
  drawNodeLabel(node) {
    const { x, y } = this.toScreenPos(node)

    this.ctx.textBaseline = "middle";
    this.ctx.strokeStyle = this.theme.background;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.lineWidth = 4;
    let fontSize = 12;
    let nW = this.theme.nodeWidth;

    if (node === this.hoveredNode || node === this.selectedNode) {
      fontSize *= 1.3
      nW *= 1.8
      this.ctx.fillStyle = this.theme.highlight
    }
    this.ctx.font = `${fontSize}px sans-serif`;

    this.ctx.strokeText(node.title, x + nW, y);
    this.ctx.fillText(node.title, x + nW, y)
  }

  /**
    * @param {Node} node
    */
  drawNode(node) {
    const { x, y } = this.toScreenPos(node)
    let nW = this.theme.nodeWidth
    this.ctx.strokeStyle = this.theme.foreground

    if (node === this.hoveredNode || node === this.selectedNode) {
      nW *= 2
      this.ctx.strokeStyle = this.theme.highlight
    }

    if (node === this.selectedNode) {
      this.ctx.fillStyle = this.theme.highlight;
      this.ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
    } else {
      this.ctx.fillStyle = this.theme.background
      this.ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
      this.ctx.lineWidth = 1
      this.ctx.strokeRect(x - nW / 2, y - nW / 2, nW, nW)
    }

  }

  /**
    * @param {Link} link */
  drawLink(link) {
    const { x: sourceX, y: sourceY } = this.toScreenPos(link.source)
    const { x: targetX, y: targetY } = this.toScreenPos(link.target)

    this.ctx.beginPath()
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 1
    this.ctx.moveTo(sourceX, sourceY)
    this.ctx.lineTo(targetX, targetY)
    this.ctx.stroke()
    this.ctx.closePath()
  }

  /**
    * @param {Node} node
    */
  drawNodeGlow(node) {
    if (!this.glow.pixels.has(node.slug)) {
      return
    }

    const { x, y } = this.toScreenPos(node)
    const gpw = this.theme.glowPixelWidth * this.transform.k
    const gpg = this.theme.glowPixelGap * this.transform.k
    const saturation = this.theme.darkMode ? 50 : 30;

    for (const pixel of this.glow.pixels.get(node.slug)) {
      const hue = this.glow.hues.get(pixel.type)
      const hslStr = `hsla(${hue}, ${saturation}%, 50%, 0.4)`
      const glowColor = d3.color(hslStr)?.formatHex()

      const pixelX = x + (pixel.x_shift * (gpw + gpg))
      const pixelY = y + (pixel.y_shift * (gpw + gpg))

      this.ctx.fillStyle = glowColor
      this.ctx.fillRect(pixelX, pixelY, gpw, gpw)
    }
  }
}


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
