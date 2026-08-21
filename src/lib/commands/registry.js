/**
 * The command palette's vocabulary.
 *
 * A command is data: an id, a title to match against, and a `run` that takes
 * the context bag and calls a store action. Nothing here reaches into the DOM
 * or navigates directly — every effect goes through a store, which is what
 * keeps a command and the toolbar button beside it from drifting apart.
 *
 * @typedef {import('../state/layout.js').LayoutStore} LayoutStore
 * @typedef {import('../state/tiles.js').TilesStore} TilesStore
 * @typedef {import('../state/prefs.js').PrefsStore} PrefsStore
 * @typedef {import('../state/viz.js').VizStore} VizStore
 * @typedef {import('../state/filter.js').FilterStore} FilterStore
 * @typedef {import('../state/overlay.js').OverlayStore} OverlayStore
 *
 * @typedef {Object} CommandContext
 * @property {LayoutStore} layout
 * @property {TilesStore} tiles
 * @property {PrefsStore} prefs
 * @property {VizStore} viz
 * @property {FilterStore} filter
 * @property {OverlayStore} overlay
 * @property {{
 *   layout: import('../state/layout.js').LayoutState,
 *   tiles: import('../state/tiles.js').TilesState,
 *   prefs: import('../state/prefs.js').PrefsState,
 *   viz: import('../state/viz.js').VizState,
 *   filter: import('../state/filter.js').FilterState,
 * }} values a snapshot of the stores above, refreshed by `CommandOverlay`
 *
 * @typedef {Object} Command
 * @property {string} id
 * @property {string} title shown in the palette
 * @property {string[]} [keywords] extra match terms
 * @property {'Layout'|'Content'|'Visualization'|'Navigation'} [group]
 * @property {(ctx: CommandContext) => void} run
 * @property {(ctx: CommandContext) => boolean} [enabled]
 */

/**
 * The two visualization toggles below are written against a *setting name*, not
 * against the force graph. `viz.updateSettings` writes into whichever
 * visualization is active, and `enabled` asks whether that one actually has the
 * setting — so a second visualization with its own settings needs no change
 * here, and does not inherit a command that would do nothing.
 *
 * @param {CommandContext} ctx
 * @param {string} key
 */
function hasSetting(ctx, key) {
  const { activeId, settings } = ctx.values.viz;
  return Object.prototype.hasOwnProperty.call(settings[activeId] ?? {}, key);
}

/**
 * @param {CommandContext} ctx
 * @param {string} key
 */
function toggleSetting(ctx, key) {
  const { activeId, settings } = ctx.values.viz;
  ctx.viz.updateSettings(activeId, { [key]: !settings[activeId]?.[key] });
}

/** @type {Command[]} */
export const commands = [
  {
    id: 'layout.cycle',
    title: 'Cycle layout',
    keywords: ['view', 'panes', 'toggle', 'split'],
    group: 'Layout',
    run: (ctx) => ctx.layout.cycle()
  },
  {
    id: 'layout.viz',
    title: 'Show visualization only',
    keywords: ['graph', 'full screen', 'hide notes'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('viz')
  },
  {
    id: 'layout.content',
    title: 'Show content only',
    keywords: ['notes', 'reading', 'hide graph'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('content')
  },
  {
    id: 'layout.split',
    title: 'Show split view',
    keywords: ['side by side', 'both'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('split')
  },
  {
    id: 'content.split',
    title: 'Split content right',
    keywords: ['column', 'duplicate', 'side by side'],
    group: 'Content',
    run: (ctx) => ctx.tiles.splitRight()
  },
  {
    id: 'content.closeTile',
    title: 'Close focused note',
    keywords: ['column', 'dismiss'],
    group: 'Content',
    // A disabled command is still listed, greyed out. Hiding it would make the
    // palette's vocabulary depend on the state you happen to be in, which is
    // the opposite of discoverable.
    enabled: (ctx) => ctx.values.tiles.tiles.length > 0,
    run: (ctx) => {
      const { tiles, focusIndex } = ctx.values.tiles;
      const focused = tiles[focusIndex];
      if (focused) ctx.tiles.close(focused.id);
    }
  },
  {
    id: 'content.toggleMeta',
    title: 'Toggle note metadata',
    keywords: ['frontmatter', 'backlinks', 'tags', 'reading time'],
    group: 'Content',
    run: (ctx) => ctx.prefs.toggleMeta()
  },
  {
    id: 'viz.toggleConnections',
    title: 'Toggle connections',
    keywords: ['links', 'edges', 'graph'],
    group: 'Visualization',
    enabled: (ctx) => hasSetting(ctx, 'showConnections'),
    run: (ctx) => toggleSetting(ctx, 'showConnections')
  },
  {
    id: 'viz.toggleTagGlow',
    title: 'Toggle tag glow',
    keywords: ['colour', 'color', 'tags', 'graph'],
    group: 'Visualization',
    enabled: (ctx) => hasSetting(ctx, 'showTagsGlow'),
    run: (ctx) => toggleSetting(ctx, 'showTagsGlow')
  },
  {
    id: 'overlay.search',
    title: 'Search notes',
    keywords: ['find', 'open', 'go to'],
    group: 'Navigation',
    run: (ctx) => ctx.overlay.open('search')
  },
  {
    id: 'overlay.filter',
    title: 'Filter notes',
    keywords: ['restrict', 'narrow', 'graph'],
    group: 'Navigation',
    run: (ctx) => ctx.overlay.open('filter')
  },
  {
    id: 'filter.clear',
    title: 'Clear filter',
    keywords: ['reset', 'show all'],
    group: 'Navigation',
    // Closing the filter overlay does not clear the filter, so this is the one
    // command that undoes it from anywhere.
    enabled: (ctx) => ctx.values.filter.query !== null,
    run: (ctx) => ctx.filter.clear()
  }
];
