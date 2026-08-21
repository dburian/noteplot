import * as d3 from 'd3';
// The *resolved* Tailwind config, serialised into a virtual module by
// `vite.config.js` — canvas drawing cannot use CSS classes. Its type lives in
// `src/app.d.ts`; if canvas colours ever go wrong, check that plugin first.
import tailwindConfig from 'virtual:tailwind-config';
const tailwindColors = tailwindConfig.theme.colors;

// A label is drawn to the *right* of its node, at 12-16px, so a node off the
// left edge by more than the label is wide contributes nothing. Measuring the
// text to find that width would cost more than the draw call it saves, so this
// is a generous constant instead.
const LABEL_REACH = 400;

/**
 * @param {{x: Number, y: Number}} p1
 * @param {{x: Number, y: Number}} p2
 */
function dist(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * @typedef {{x_shift: Number, y_shift: Number, type: string}} GlowPixel
 * @typedef {{light: string, dark: string}} GlowColor
 * @typedef {{pixels: Map<string, GlowPixel[]>, colors: Map<string, GlowColor>, maxShift: Number}} Glow
 * @typedef {{source: Node, target: Node}} Link
 * @typedef {{source: string, target: string}} SerialisedLink
 * @typedef {{tags: Array<string>}} FrontMatter
 * @typedef {{slug: string, title: string, x: Number, y: Number, matter: FrontMatter}} Node
 * @typedef {{slug: string, title?: string}} NoteRef
 * @typedef {{activeNote: NoteRef | null, hoveredNote: NoteRef | null}} SelectionState
 * @typedef {import("svelte/store").Readable<SelectionState>} SelectionStore
 * @typedef {{showConnections: boolean, showTagsGlow: boolean}} ForceGraphSettings
 * @typedef {import("svelte/store").Readable<ForceGraphSettings>} SettingsStore
 * @typedef {{
 * query: import("minisearch").Query | null,
 * results: import("$lib/search/search_index").Match[] | null,
 * }} FilterState
 * @typedef {import("svelte/store").Readable<FilterState>} FilterStore
 */

/**
 * Sample Normal distribution with unit mean and unit variance using the
 * Box–Muller transform.
 *
 * @param {() => Number} random a uniform source on [0, 1)
 * @returns {Number}
 */
function sample_normal(random) {
  const u1 = 1 - random();
  const u2 = 1 - random();

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * mulberry32: a small, fast, seedable PRNG.
 *
 * The glow used to be sampled from `Math.random()`, so a note's tag cloud was
 * laid out differently every time the page was opened (ISSUES.md C14).
 *
 * @param {Number} seed
 * @returns {() => Number} uniform on [0, 1)
 */
function mulberry32(seed) {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a, so a slug can be turned into a seed.
 *
 * @param {String} str
 * @returns {Number}
 */
function hashString(str) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

class GraphRenderer {
  /** @param {() => void} redrawFn */
  constructor(redrawFn) {
    this.theme = {
      nodeWidth: 10,
      foreground: '#0f172a',
      background: '#ffffff',
      highlight: '#000',
      darkMode: false,
      glowPixelWidth: 3,
      glowPixelGap: 0.5,
      numGlowPixels: 20
    };

    this.redraw = redrawFn;

    // Kept as a field only so `destruct` can unregister it. Harmless while the
    // graph was the only thing on screen and never unmounted; the moment
    // visualizations became swappable, every swap leaked a listener holding a
    // reference to a dead renderer.
    this.darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');
    this.setDarkMode(this.darkModePreference.matches);
    this.darkModePreference.addEventListener('change', this.onDarkMode);
  }

  destruct() {
    this.darkModePreference.removeEventListener('change', this.onDarkMode);
  }

  /**
   * @param {MediaQueryListEvent} event */
  onDarkMode = (event) => {
    this.setDarkMode(event.matches);

    this.redraw();
  };

  /**
   * @param {boolean} darkModeOn */
  setDarkMode(darkModeOn) {
    if (darkModeOn) {
      this.theme.foreground = tailwindColors.front.dark;
      this.theme.background = tailwindColors.back.dark;
      this.theme.highlight = tailwindColors.emphasis.dark;
    } else {
      this.theme.foreground = tailwindColors.front.light;
      this.theme.background = tailwindColors.back.light;
      this.theme.highlight = tailwindColors.emphasis.light;
    }

    this.theme.darkMode = darkModeOn;
  }

  /**
   * @param {Map<String, Node>} nodes
   * @param {Map<String, Map<String, Link>>} links
   * @param {Glow} glow
   * @param {CanvasScreen} screen
   * @param {SelectionState} selection which node is active and which is hovered
   * @param {ForceGraphSettings} settings the force graph's own toggles
   *
   */
  draw(nodes, links, glow, screen, selection, settings) {
    const ctx = screen.ctx;
    ctx.resetTransform();
    ctx.scale(screen.dpr, screen.dpr);

    ctx.clearRect(0, 0, screen.width, screen.height);

    /** @param {Node} node */
    const isHovered = (node) => node.slug == selection.hoveredNote?.slug;
    /** @param {Node} node */
    const isSelected = (node) => node.slug == selection.activeNote?.slug;

    const view = this.visibleBox(screen);

    if (settings.showTagsGlow) {
      const colors = glow.colors;
      // The furthest any square actually sits from its node. `glow.maxShift` is
      // in grid steps and is measured once, in `generateGlow`; the step itself
      // scales with the zoom. Guessing this from the sampling parameters would
      // mean guessing how far into the normal's tail the samples went.
      const glowReach =
        glow.maxShift * (this.theme.glowPixelWidth + this.theme.glowPixelGap) * screen.transform.k;
      for (const node of nodes.values()) {
        const pixels = glow.pixels.get(node.slug);
        if (pixels && this.isNodeVisible(node, screen, view, glowReach)) {
          this.drawNodeGlow(pixels, colors, node, screen);
        }
      }
    }

    if (settings.showConnections) {
      for (const byTarget of links.values()) {
        for (const link of byTarget.values()) {
          if (!this.isLinkVisible(link, screen, view)) continue;

          this.drawLink(link, screen);
        }
      }
    }

    // Half the width of the largest a node is ever drawn -- `drawNode` doubles
    // `nodeWidth` for the hovered and selected ones.
    const nodeReach = this.theme.nodeWidth;
    for (const node of nodes.values()) {
      if (!this.isNodeVisible(node, screen, view, nodeReach)) continue;

      this.drawNode(node, screen, isHovered(node), isSelected(node));
    }

    if (screen.transform.k > 2) {
      for (const node of nodes.values()) {
        if (!this.isLabelVisible(node, screen, view)) continue;

        this.drawNodeLabel(node, screen, isHovered(node), isSelected(node));
      }
    }

    // Redraw selected/hovered nodes so they end up on the top
    for (const note of [selection.activeNote, selection.hoveredNote]) {
      if (!note) continue;
      const node = nodes.get(note.slug);
      if (!node) continue;

      this.drawNode(node, screen, isHovered(node), isSelected(node));
      this.drawNodeLabel(node, screen, isHovered(node), isSelected(node));
    }
  }

  /**
   * The part of the canvas anything drawn can actually be seen in, in CSS
   * pixels — which is now simply all of it. The canvas is a flex child sized
   * to exactly its visible area, so nothing is painted over it and there is no
   * inset to subtract.
   *
   * @param {CanvasScreen} screen
   * @returns {{minX: Number, minY: Number, maxX: Number, maxY: Number}}
   */
  visibleBox(screen) {
    return {
      minX: 0,
      minY: 0,
      maxX: screen.width,
      maxY: screen.height
    };
  }

  /**
   * Whether `node` can put ink inside `view`, allowing `reach` CSS pixels of
   * slop for whatever is drawn around its centre.
   *
   * Everything above the fit-to-window zoom draws mostly off-screen, and every
   * node, link and label used to be painted regardless (ISSUES.md C4).
   *
   * @param {Node} node
   * @param {CanvasScreen} screen
   * @param {{minX: Number, minY: Number, maxX: Number, maxY: Number}} view
   * @param {Number} reach
   */
  isNodeVisible(node, screen, view, reach) {
    const { x, y } = screen.toScreenPos(node);

    return (
      x + reach >= view.minX &&
      x - reach <= view.maxX &&
      y + reach >= view.minY &&
      y - reach <= view.maxY
    );
  }

  /**
   * Whether `node`'s label can put ink inside `view`.
   *
   * Asymmetric, unlike `isNodeVisible`: a label is drawn to the **right** of
   * its node, so a node off the left edge can still show one but a node off
   * the right edge cannot. Using one symmetric margin for both would keep a
   * `LABEL_REACH`-wide strip of invisible labels along the right edge, which
   * at high zoom is a good fraction of the window.
   *
   * @param {Node} node
   * @param {CanvasScreen} screen
   * @param {{minX: Number, minY: Number, maxX: Number, maxY: Number}} view
   */
  isLabelVisible(node, screen, view) {
    const { x, y } = screen.toScreenPos(node);
    // Half the tallest line, which is the hovered/selected 12 * 1.3px.
    const vertical = this.theme.nodeWidth;

    return (
      x + LABEL_REACH >= view.minX &&
      x <= view.maxX &&
      y + vertical >= view.minY &&
      y - vertical <= view.maxY
    );
  }

  /**
   * Whether `link`'s segment can cross `view`.
   *
   * Rejects only when **both** endpoints are outside the same edge, which is
   * conservative: a link whose endpoints are off opposite edges still crosses
   * the screen and is kept. Testing the endpoints individually would drop it.
   *
   * @param {Link} link
   * @param {CanvasScreen} screen
   * @param {{minX: Number, minY: Number, maxX: Number, maxY: Number}} view
   */
  isLinkVisible(link, screen, view) {
    const a = screen.toScreenPos(link.source);
    const b = screen.toScreenPos(link.target);

    if (a.x < view.minX && b.x < view.minX) return false;
    if (a.x > view.maxX && b.x > view.maxX) return false;
    if (a.y < view.minY && b.y < view.minY) return false;
    if (a.y > view.maxY && b.y > view.maxY) return false;

    return true;
  }

  /**
   * @param {Node} node
   * @param {CanvasScreen} screen
   * @param {boolean} hovered
   * @param {boolean} selected
   */
  drawNodeLabel(node, screen, hovered, selected) {
    const { x, y } = screen.toScreenPos(node);

    const ctx = screen.ctx;
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = this.theme.background;
    ctx.fillStyle = this.theme.foreground;
    ctx.lineWidth = 4;
    let fontSize = 12;
    let nW = this.theme.nodeWidth;

    if (hovered || selected) {
      fontSize *= 1.3;
      nW *= 1.8;
      ctx.fillStyle = this.theme.highlight;
    }
    ctx.font = `${fontSize}px sans-serif`;

    ctx.strokeText(node.title, x + nW, y);
    ctx.fillText(node.title, x + nW, y);
  }

  /**
   * @param {Node} node
   * @param {CanvasScreen} screen
   */
  drawNode(node, screen, hovered = false, selected = false) {
    const { x, y } = screen.toScreenPos(node);
    let nW = this.theme.nodeWidth;
    const ctx = screen.ctx;
    ctx.strokeStyle = this.theme.foreground;

    if (hovered || selected) {
      nW *= 2;
      ctx.strokeStyle = this.theme.highlight;
    }

    if (selected) {
      ctx.fillStyle = this.theme.highlight;
      ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW);
    } else {
      ctx.fillStyle = this.theme.background;
      ctx.fillRect(x - nW / 2, y - nW / 2, nW, nW);
      ctx.lineWidth = 1;
      ctx.strokeRect(x - nW / 2, y - nW / 2, nW, nW);
    }
  }

  /**
   * @param {Link} link
   * @param {CanvasScreen} screen
   */
  drawLink(link, screen) {
    const { x: sourceX, y: sourceY } = screen.toScreenPos(link.source);
    const { x: targetX, y: targetY } = screen.toScreenPos(link.target);

    const ctx = screen.ctx;
    ctx.beginPath();
    ctx.strokeStyle = this.theme.foreground;
    ctx.lineWidth = 1;
    ctx.moveTo(sourceX, sourceY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.closePath();
  }

  /**
   * @param {GlowPixel[]} pixels
   * @param {Map<String, GlowColor>} colors
   * @param {Node} node
   * @param {CanvasScreen} screen
   */
  drawNodeGlow(pixels, colors, node, screen) {
    const { x, y } = screen.toScreenPos(node);
    const gpw = this.theme.glowPixelWidth * screen.transform.k;
    const gpg = this.theme.glowPixelGap * screen.transform.k;
    const variant = this.theme.darkMode ? 'dark' : 'light';

    const ctx = screen.ctx;

    for (const pixel of pixels) {
      // Both variants are precomputed once per tag in `generateGlow`. Parsing
      // an `hsla()` string here meant 20 squares x every node x every frame
      // (ISSUES.md C3).
      const pixelX = x + pixel.x_shift * (gpw + gpg);
      const pixelY = y + pixel.y_shift * (gpw + gpg);

      const color = colors.get(pixel.type);
      if (!color) continue;

      ctx.fillStyle = color[variant];
      ctx.fillRect(pixelX, pixelY, gpw, gpw);
    }
  }
}

class CanvasScreen {
  /**
   * @param {[Number, Number, Number, Number] | null} viewBox
   * @param {HTMLCanvasElement} canvas
   * @param {() => void} redrawFn
   */
  constructor(viewBox, canvas, redrawFn) {
    // `graph_pipeline.js` always writes four finite numbers now, but a
    // `__graph.json` left over from an older build can still hold `null`.
    const [minX, minY, width, height] = viewBox || [0, 0, 1, 1];
    this.viewBox = { minX, minY, width, height };
    this.transform = {
      x: 0,
      y: 0,
      k: 1
    };
    this.redraw = redrawFn;

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    // Only null if the element already has a context of another kind, which
    // cannot happen for a canvas this class was handed at mount. Asserted
    // rather than tolerated, so the thirty draw calls downstream do not each
    // have to ask.
    if (!ctx) throw new Error('CanvasScreen: could not get a 2d context');
    this.ctx = ctx;

    // A `ResizeObserver` on the canvas, not a `window` resize listener. The
    // canvas is a flex child now, so it changes size for three reasons -- the
    // window resizing, the divider being dragged, and the layout mode changing
    // -- and only the first of those is a `resize` event. This one mechanism
    // covers all three, and replaces the `contentSliderState.pixelWidth` ->
    // `setInsetRight` plumbing that used to tell the renderer how much of it was
    // hidden (ISSUES.md C13): nothing is laid over it any more.
    //
    // Observing the canvas is only safe because `updateCanvasSize` never writes
    // its CSS size -- the element is stretched by its parent and only the
    // backing store is resized here, so this cannot feed back into itself.
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(canvas);

    // Just to convince LS these properties exist
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.updateCanvasSize();

    // Just to convince LS these properties exist
    this.paintBox = {
      minX: 0,
      minY: 0,
      width: 0,
      height: 0
    };
    this.updatePaintBox();
    this.addZoom();
  }

  destruct() {
    this.resizeObserver.disconnect();
    // d3 registers its own wheel/pointer/touch listeners on the element when
    // `call(zoomBehavior)` runs. The canvas is discarded with the component, so
    // this is belt and braces -- but `destruct` is the swap path now, and a
    // half-torn-down renderer is not something to leave to the GC.
    d3.select(this.canvas).on('.zoom', null);
  }

  addZoom() {
    // `[1, 15]` is the removed SVG renderer's `[1, maxZoomCoef]`. Without it
    // zooming out is unbounded and the graph shrinks to nothing (ISSUES.md
    // C12); `1` is the fit-to-window scale, so there is nothing below it.
    const zoomBehavior = d3.zoom().scaleExtent([1, 15]).on('zoom', this.onZoom);
    d3.select(this.canvas).call(zoomBehavior);
  }

  /** @param {{transform: {x: Number, y: Number, k: Number}}} event */
  onZoom = (event) => {
    this.transform = event.transform;
    this.redraw();
  };

  onResize = () => {
    this.updateCanvasSize();
    this.updatePaintBox();
    this.redraw();
  };

  /**
   * The canvas's own size, from the element rather than from the window. The
   * canvas fills its pane and the pane is a flex child, so `window.innerWidth`
   * has not been the answer since the shell grew a toolbar and a divider.
   *
   * Writes only the backing store (`canvas.width`/`height`), never
   * `canvas.style.*`: the element's CSS size is the parent's business, and
   * writing it here would make the `ResizeObserver` observe its own output.
   * `dpr` handling is unchanged -- the context is scaled by it in
   * `GraphRenderer.draw`, so every coordinate outside this method stays in CSS
   * pixels.
   */
  updateCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = window.devicePixelRatio;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  /**
   * Turns a pointer event into a position on the canvas.
   *
   * The canvas used to be `fixed top-0 left-0` and full-screen, so
   * `clientX`/`clientY` were already canvas coordinates. It is a flex child
   * below a toolbar now, and skipping this offset silently shifts every hit
   * test by the toolbar's height -- which reads as a coordinate-maths bug and
   * is not one.
   *
   * @param {{clientX: Number, clientY: Number}} event
   * @returns {{x: Number, y: Number}}
   */
  toCanvasPos(event) {
    const rect = this.canvas.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  updatePaintBox() {
    // Both floored at 1. A pane can genuinely be zero-sized -- mid-drag, or for
    // the frame before the flex row is laid out -- and a zero-sized paintBox
    // makes every `toScreenPos` divide by zero and hand the canvas NaN.
    const availWidth = Math.max(this.width, 1);
    const availHeight = Math.max(this.height, 1);

    const viewBoxAR = this.viewBox.width / this.viewBox.height;
    const trueAR = availWidth / availHeight;

    const paintBox = { minX: 0, minY: 0, width: 0, height: 0 };
    if (viewBoxAR > trueAR) {
      //True is less width or more height -> we enlarge width and center height

      paintBox.width = availWidth;
      paintBox.height = availWidth / viewBoxAR;
      paintBox.minY = (availHeight - paintBox.height) / 2;
    } else {
      paintBox.height = availHeight;
      paintBox.width = availHeight * viewBoxAR;
      paintBox.minX = (availWidth - paintBox.width) / 2;
    }

    this.paintBox = paintBox;
  }

  /**
   * @param {{x: Number, y: Number}} viewBoxPos */
  toScreenPos(viewBoxPos) {
    const normX = (viewBoxPos.x - this.viewBox.minX) / this.viewBox.width;
    const normY = (viewBoxPos.y - this.viewBox.minY) / this.viewBox.height;
    const screenX = this.paintBox.minX + normX * this.paintBox.width;
    const screenY = this.paintBox.minY + normY * this.paintBox.height;

    return {
      x: screenX * this.transform.k + this.transform.x,
      y: screenY * this.transform.k + this.transform.y
    };
  }

  /**
   * Turns screen position into viewbox position.
   * @param {{x: Number, y: Number}} screenPos
   *
   * @returns {{x: Number, y: Number}} */
  toViewBoxPos(screenPos) {
    const screenX = (screenPos.x - this.transform.x) / this.transform.k;
    const screenY = (screenPos.y - this.transform.y) / this.transform.k;

    const normX = (screenX - this.paintBox.minX) / this.paintBox.width;
    const normY = (screenY - this.paintBox.minY) / this.paintBox.height;

    const viewBoxX = normX * this.viewBox.width + this.viewBox.minX;
    const viewBoxY = normY * this.viewBox.height + this.viewBox.minY;

    return { x: viewBoxX, y: viewBoxY };
  }
}

export class CanvasGraph {
  /**
   * One options object rather than six positional arguments, and no router:
   * this class knows nothing about the app it is mounted in beyond the two
   * stores it reads and the two callbacks it calls.
   *
   * `selection` and `filter` are **read** here; the writes go out through
   * `onActivate` and `onHover`, which is what keeps the note-ref shape (and
   * the decision of which tile a click opens into) in the pane rather than in
   * the renderer.
   *
   * @param {Object} options
   * @param {Array<Node>} options.nodes
   * @param {Array<Link|SerialisedLink>} options.links
   * @param {[Number, Number, Number, Number] | null} options.viewBox
   * @param {HTMLCanvasElement} options.canvas
   * @param {SelectionStore} options.selection which node is active/hovered
   * @param {FilterStore} options.filter which nodes are in play
   * @param {SettingsStore} options.settings this visualization's own toggles
   * @param {(slug: string) => void} options.onActivate a node was clicked
   * @param {(node: Node | null) => void} options.onHover the hovered node changed
   */
  constructor({ nodes, links, viewBox, canvas, selection, filter, settings, onActivate, onHover }) {
    this.onActivate = onActivate;
    this.onHoverNode = onHover;

    this.nodes = new Map();
    this.links = new Map();
    /** @type {number | null} */
    this.pendingFrame = null;
    for (const node of nodes) this.nodes.set(node.slug, node);

    // `__graph.json` carries a link as a pair of slugs. A file from a build
    // before that change holds embedded node objects instead, and rejecting it
    // outright would be fatal -- the same reasoning as the A17 fix -- so both
    // shapes resolve through `nodes`. Either way the endpoints end up as
    // references into `nodes`, so a node and its links cannot disagree.
    /** @param {Node|string} endpoint */
    const resolve = (endpoint) =>
      this.nodes.get(typeof endpoint === 'string' ? endpoint : endpoint?.slug);

    for (const link of links) {
      const source = resolve(link.source);
      const target = resolve(link.target);
      if (!source || !target) continue;

      if (!this.links.has(source.slug)) {
        this.links.set(source.slug, new Map());
      }
      this.links.get(source.slug).set(target.slug, { source, target });
    }

    this.renderer = new GraphRenderer(this.draw);
    this.screen = new CanvasScreen(viewBox, canvas, this.draw);

    this.grid = this.constructGrid();
    this.fillGrid();

    canvas.addEventListener('click', this.onClick);
    // `pointermove`, not `mousemove`, so `onHover` can tell a real mouse from a
    // synthesised touch using the standard `pointerType`.
    canvas.addEventListener('pointermove', this.onHover);
    this.glow = this.generateGlow();

    // Subscribing to a store calls back synchronously, before this constructor
    // has finished building the object those callbacks draw from.
    this.deferDraw = true;

    /** @type {SelectionState} */
    this.selection;
    this.selectionUnsubscribe = selection.subscribe(this.onSelectionChange);

    /** @type {ForceGraphSettings} */
    this.settings;
    this.settingsUnsubscribe = settings.subscribe(this.onSettingsChange);

    this.filteredNodes = this.nodes;
    this.filteredLinks = this.links;
    // The results the filtered maps were last built from. `undefined`, not
    // `null`, so the store's initial `{query: null, results: null}` still
    // counts as a change and the subscription's first call runs.
    /** @type {import("$lib/search/search_index").Match[] | null | undefined} */
    this.filterResults = undefined;
    this.filterUnsubscribe = filter.subscribe(this.onFilterChange);

    this.deferDraw = false;
    this.draw();
  }

  destruct() {
    if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
    this.screen.canvas.removeEventListener('click', this.onClick);
    this.screen.canvas.removeEventListener('pointermove', this.onHover);
    this.screen.destruct();
    this.renderer.destruct();
    this.selectionUnsubscribe();
    this.settingsUnsubscribe();
    this.filterUnsubscribe();
  }

  /**
   * @param {SelectionState} newSelection
   */
  onSelectionChange = (newSelection) => {
    if (this.selection !== newSelection) {
      this.selection = newSelection;
      this.draw();
    }
  };

  /**
   * @param {ForceGraphSettings} newSettings
   */
  onSettingsChange = (newSettings) => {
    if (this.settings !== newSettings) {
      this.settings = newSettings;
      this.draw();
    }
  };

  /**
   * @param {FilterState} newFilter
   */
  onFilterChange = (newFilter) => {
    // The store also carries `query`, which nothing here draws, so a write
    // that leaves `results` alone cannot change the picture (ISSUES.md C11).
    if (newFilter.results === this.filterResults) return;
    this.filterResults = newFilter.results;

    this.filteredNodes = this.nodes;
    this.filteredLinks = this.links;

    if (newFilter.results) {
      this.filteredNodes = new Map();
      this.filteredLinks = new Map();

      for (const match of newFilter.results) {
        this.filteredNodes.set(match.note.slug, this.nodes.get(match.note.slug));
      }

      /** @param {Link} link */
      const addLink = (link) => {
        if (!this.filteredLinks.has(link.source.slug)) {
          this.filteredLinks.set(link.source.slug, new Map());
        }
        this.filteredLinks.get(link.source.slug).set(link.target.slug, link);
      };

      for (const slug of this.filteredNodes.keys()) {
        if (!this.links.has(slug)) continue;

        for (const targetSlug of this.links.get(slug).keys()) {
          if (this.filteredNodes.has(targetSlug)) {
            addLink(this.links.get(slug).get(targetSlug));
          }
        }
      }
    }

    this.draw();
  };

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
    const viewBox = this.screen.viewBox;
    // Aim for ~4 nodes per cell, so a mousemove scans a handful of nodes
    // rather than the ~N/25 a fixed 5x5 grid left it with (ISSUES.md C6).
    const targetCells = Math.max(Math.ceil(this.nodes.size / 4), 1);
    // `|| 1` catches a zero-sized viewBox -- a collection of one note, or one
    // where every node sits at the same point. Without it `gridSize` is 0, the
    // row and column counts are NaN, and `Array(NaN)` throws `RangeError:
    // Invalid array length`, so the graph never mounts at all.
    const gridSize = Math.sqrt((viewBox.width * viewBox.height) / targetCells) || 1;
    const numRows = Math.max(Math.ceil(viewBox.height / gridSize), 1);
    const numCols = Math.max(Math.ceil(viewBox.width / gridSize), 1);

    /** @type Array<Array<Array<Node>>> */
    const rows = [];
    for (const _ of Array(numRows)) {
      /** @type Array<Array<Node>> */
      const cols = [];
      for (const _ of Array(numCols)) {
        cols.push([]);
      }
      rows.push(cols);
    }

    return {
      rows: rows,
      cellSize: gridSize,
      numCols,
      numRows
    };
  }

  /**
   * Clamps a grid index into the grid, mapping a non-finite index to 0.
   *
   * @param {Number} idx
   * @param {Number} max
   */
  clampGridIdx(idx, max) {
    if (!Number.isFinite(idx)) return 0;

    return Math.min(Math.max(idx, 0), max);
  }

  fillGrid() {
    for (const node of this.nodes.values()) {
      const { col, row } = this.toGridIdxs(node);
      // Clamped, unlike in `getNode`: a node sitting exactly on the padded
      // viewBox boundary rounds to one cell past the end, and it has to be put
      // somewhere. `getNode` rejects out-of-grid pointer positions instead.
      const gridRow = this.clampGridIdx(row, this.grid.numRows - 1);
      const gridCol = this.clampGridIdx(col, this.grid.numCols - 1);

      this.grid.rows[gridRow][gridCol].push(node);
    }
  }

  /**
   * Generates glow pixels for each node. Glow is a pixelated 'hue' around
   * each node signilizing its type.
   *
   * @returns {Glow}
   */
  generateGlow() {
    const types = new Set();

    /**
     * @type {Map<string, Array<GlowPixel>>}
     */
    const pixels = new Map();

    // How far the furthest square ends up from its node, in grid steps. The
    // offsets are normal samples, so this is a property of the draw rather than
    // of the parameters; the renderer needs it to know how much slop to allow
    // when culling (ISSUES.md C4).
    let maxShift = 0;

    for (const node of this.nodes.values()) {
      const nodeTypes = node.matter?.tags || [];
      // No glow for nodes without type
      if (nodeTypes.length == 0) {
        continue;
      }
      /** @type {Array<GlowPixel>} */
      const nodePixels = [];
      pixels.set(node.slug, nodePixels);

      // Seeded per node, not once for the whole run: a node's cloud is then
      // independent of how many notes there are and of the order they come in,
      // so adding a note does not reshuffle every other node's glow.
      const random = mulberry32(hashString(node.slug));

      const glowPixesPerType = Math.ceil(this.renderer.theme.numGlowPixels / nodeTypes.length);
      for (const type of nodeTypes) {
        types.add(type);

        for (const _ of Array(glowPixesPerType)) {
          const x_shift = Math.floor(sample_normal(random) * 5);
          const y_shift = Math.floor(sample_normal(random) * 5);
          maxShift = Math.max(maxShift, Math.abs(x_shift), Math.abs(y_shift));

          nodePixels.push({ x_shift: x_shift, y_shift: y_shift, type });
        }
      }
    }

    /** @type {Map<string, GlowColor>} */
    const colors = new Map();
    let lastHue = 0;
    const hueStep = 360 / types.size;
    for (const type of types) {
      // `formatHex()` drops the alpha, so the glow has always been opaque --
      // kept as is, precomputing it is meant to be a pure performance change.
      /** @param {number} saturation */
      const hex = (saturation) =>
        d3.color(`hsla(${lastHue}, ${saturation}%, 50%, 0.4)`)?.formatHex();

      colors.set(type, { light: hex(30), dark: hex(50) });
      lastHue += hueStep;
    }

    // `+ 1` for the square's own width, which is drawn from the offset
    // outwards.
    return { pixels, colors, maxShift: maxShift + 1 };
  }

  /**
   * @param {MouseEvent} event */
  onClick = (event) => {
    const node = this.getNode(this.screen.toCanvasPos(event));

    if (node && this.filteredNodes.has(node.slug)) {
      this.onActivate(node.slug);
    }
  };

  /**
   * @param {PointerEvent} event */
  onHover = (event) => {
    // Disable hover events on mobile. `pointerType` is standard; the
    // `sourceCapabilities.firesTouchEvents` this used to read is Chrome-only,
    // so it threw on every mousemove in Firefox and Safari.
    if (event.pointerType !== 'mouse') return;

    const node = this.getNode(this.screen.toCanvasPos(event));

    if (node && this.filteredNodes.has(node.slug)) {
      this.onHoverNode(node);
      // Not `body.style = ...`, which assigns to `cssText` and drops every
      // other inline style (ISSUES.md C10).
      document.body.style.cursor = 'pointer';
    } else if (!node && this.selection.hoveredNote !== null) {
      this.onHoverNode(null);
      document.body.style.cursor = 'default';
    }
  };

  /**
   * Schedules one redraw per frame. Zoom, resize, hover, filtering and the
   * dark-mode listener all request a redraw independently and several
   * routinely land within a single frame (ISSUES.md C2), so this coalesces
   * them; `deferDraw` still suppresses drawing outright during construction.
   */
  draw = () => {
    if (this.deferDraw) return;
    if (this.pendingFrame !== null) return;

    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.drawNow();
    });
  };

  /** Paints a frame immediately. Everything else goes through `draw`. */
  drawNow() {
    this.renderer.draw(
      this.filteredNodes,
      this.filteredLinks,
      this.glow,
      this.screen,
      this.selection,
      this.settings
    );
  }

  /**
   * @param {{x: Number, y: Number}} screenPos canvas-relative, in CSS pixels
   * @returns {Node | null}
   */
  getNode(screenPos) {
    const viewBoxPos = this.screen.toViewBoxPos(screenPos);
    const gridCoords = this.toGridIdxs(viewBoxPos);
    if (
      gridCoords.row < 0 ||
      gridCoords.col < 0 ||
      gridCoords.row >= this.grid?.numRows ||
      gridCoords.col >= this.grid?.numCols
    ) {
      return null;
    }

    const gridItems = this.grid.rows[gridCoords.row][gridCoords.col];

    if (gridItems.length == 0) return null;

    // CSS pixels: `toScreenPos` never sees `dpr`, the context is scaled by it
    // instead, so factoring it in here doubled the radius on retina displays
    // (ISSUES.md C7).
    const eps = 10;
    for (const node of gridItems) {
      const nodeDist = dist(this.screen.toScreenPos(node), screenPos);
      if (nodeDist < eps) {
        return node;
      }
    }

    return null;
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
      row: Math.floor((viewBoxPos.y - this.screen.viewBox.minY) / this.grid.cellSize)
    };
  }
}
