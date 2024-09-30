import * as d3 from "d3";
import { draw } from "svelte/transition";

function dist(p1, p2) {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2
  )
}

export class CanvasGraph {
  constructor(nodes, links, viewBox, canvas, onNodeClick) {
    this.nodes = nodes;
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
      foreground: '#000000',
      background: '#ffffff',
    }
    this.constructGrid()

    this.onNodeClick = onNodeClick;
    this.hoveredNode = null;

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')


    window.addEventListener("resize", this.onResize)
    canvas.addEventListener("click", this.onClick)
    canvas.addEventListener("mousemove", this.onHover)

    const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
    this.setDarkMode(darkModePreference.matches)
    darkModePreference.addEventListener("change", this.onDarkMode);

    this.onResize()
    this.addZoom()
  }


  destruct() {
    window.removeEventListener("resize", this.onResize)
    this.canvas.removeEventListener("click", this.onClick)
    this.canvas.removeEventListener("mousemove", this.onHover)
  }

  constructGrid() {
    const gridSize = Math.min(this.viewBox.width / 5, this.viewBox.height / 5)
    const numRows = Math.ceil(this.viewBox.height / gridSize)
    const numCols = Math.ceil(this.viewBox.width / gridSize)

    const rows = []
    for (const _ of Array(numRows)) {
      const cols = []
      for (const _ of Array(numCols)) {
        cols.push([])
      }
      rows.push(cols)
    }

    this.grid = {
      rows: rows,
      size: gridSize,
      numCols,
      numRows,
    }

    for (const node of this.nodes) {
      const { col, row } = this.toGridIdxs(node)
      rows[row][col].push(node)
    }
  }

  addZoom() {
    const zoomBehavior = d3.zoom()
      .on("zoom", this.onZoom)
    d3.select(this.canvas).call(zoomBehavior)
  }

  onZoom = (event) => {
    //TODO: why not addZoom() {...}?
    this.transform = event.transform
    this.draw()
  }

  onResize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.dpr = window.devicePixelRatio
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`

    this.computePaintBox()
    this.draw()
  }

  onClick = (event) => {
    const node = this.getNode({ x: event.clientX, y: event.clientY })

    if (node) {
      this.onNodeClick(node)
    }
  }

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
  }

  onDarkMode = (event) => {
    this.setDarkMode(event.matches)

    this.draw()
  }

  setDarkMode(darkModeOn) {
    if (darkModeOn) {
      this.theme.foreground = "#d1d5db"
      this.theme.background = "#262626"
    } else {
      this.theme.background = "#ffffff"
      this.theme.foreground = "#000000"
    }
  }

  selectNode(slug) {
    if (!slug) {
      this.selectedNode = null;
      this.draw();
      return
    }

    for (const node of this.nodes) {
      if (node.slug === slug) {
        this.selectedNode = node;
        this.draw()
        return
      }
    }
  }

  computePaintBox() {
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

  draw() {
    this.ctx.resetTransform()
    this.ctx.scale(this.dpr, this.dpr)

    this.ctx.clearRect(0, 0, this.width, this.height)

    for (const link of this.links) {
      this.drawLink(link)
    }

    for (const node of this.nodes) {
      this.drawNode(node)
    }

    if (this.transform.k > 2) {
      for (const node of this.nodes) {
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

  toViewBoxPos(screenPos) {
    const screenX = (screenPos.x - this.transform.x) / this.transform.k
    const screenY = (screenPos.y - this.transform.y) / this.transform.k

    const normX = (screenX - this.paintBox.minX) / this.paintBox.width
    const normY = (screenY - this.paintBox.minY) / this.paintBox.height

    const viewBoxX = normX * this.viewBox.width + this.viewBox.minX
    const viewBoxY = normY * this.viewBox.height + this.viewBox.minY

    return { x: viewBoxX, y: viewBoxY }
  }

  toGridIdxs(viewBoxPos) {
    return {
      col: Math.floor((viewBoxPos.x - this.viewBox.minX) / this.grid.size),
      row: Math.floor((viewBoxPos.y - this.viewBox.minY) / this.grid.size),
    }
  }

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
    }
    this.ctx.font = `${fontSize}px sans-serif`;

    this.ctx.strokeText(node.title, x + nW, y);
    this.ctx.fillText(node.title, x + nW, y)
  }

  drawNode(node) {
    const { x, y } = this.toScreenPos(node)
    let nW = this.theme.nodeWidth
    this.ctx.strokeStyle = this.theme.foreground

    if (node === this.hoveredNode || node === this.selectedNode) {
      nW *= 2
      this.ctx.fillStyle = this.theme.foreground
      this.ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
    } else {
      this.ctx.fillStyle = this.theme.background
      this.ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW)
      this.ctx.strokeRect(x - nW / 2, y - nW / 2, nW, nW)
    }

  }

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

}
