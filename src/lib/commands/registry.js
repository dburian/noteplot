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
 *   overlay: import('../state/overlay.js').OverlayState,
 * }} values a snapshot of the stores above, refreshed by `CommandOverlay`
 *
 * @typedef {Object} Command
 * @property {string} id
 * @property {string} title shown in the palette
 * @property {string} description one line under the title, saying what it does
 * @property {string[]} [keywords] extra match terms
 * @property {'Layout'|'Content'|'Visualization'|'Navigation'} [group]
 * @property {(ctx: CommandContext) => void} run
 * @property {(ctx: CommandContext) => boolean} [enabled]
 * @property {string[]} [defaultKeys] chords bound out of the box (see `chord.js`);
 *   the user's overrides live in `state/shortcuts.js`
 * @property {boolean} [allowInInput] fire the shortcut even while typing in a
 *   text field. Only `overlay.close` has it: Escape is how you leave the
 *   overlay you are typing in
 * @property {false} [palette] `false` for a shortcut-only command the palette
 *   does not list — "open the palette" and "close the overlay" from inside the
 *   palette would be nonsense
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
    description: 'Step through split, visualization only, and content only.',
    keywords: ['view', 'panes', 'toggle', 'split'],
    group: 'Layout',
    defaultKeys: ['Mod+b'],
    run: (ctx) => ctx.layout.cycle()
  },
  {
    id: 'layout.viz',
    title: 'Show visualization only',
    description: 'Give the whole window to the graph and hide the notes.',
    keywords: ['graph', 'full screen', 'hide notes'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('viz')
  },
  {
    id: 'layout.content',
    title: 'Show content only',
    description: 'Give the whole window to the notes and hide the graph.',
    keywords: ['notes', 'reading', 'hide graph'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('content')
  },
  {
    id: 'layout.split',
    title: 'Show split view',
    description: 'Show the graph and the notes side by side.',
    keywords: ['side by side', 'both'],
    group: 'Layout',
    run: (ctx) => ctx.layout.setMode('split')
  },
  {
    id: 'content.split',
    title: 'Split content right',
    description: 'Open the focused note again in a new column to its right.',
    keywords: ['column', 'duplicate', 'side by side'],
    group: 'Content',
    defaultKeys: ['Mod+\\'],
    // Reveals the content pane too: the palette is reachable in every mode,
    // and a new column is invisible while the pane is hidden.
    run: (ctx) => {
      ctx.tiles.splitRight();
      ctx.layout.reveal();
    }
  },
  {
    id: 'content.closeTile',
    title: 'Close focused note',
    description: 'Close the focused column.',
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
    title: 'Toggle search details',
    description: 'Show or hide the parsed query and the matched fields in search and filter.',
    keywords: ['metadata', 'query', 'matched fields', 'debug'],
    group: 'Content',
    run: (ctx) => ctx.prefs.toggleMeta()
  },
  {
    id: 'viz.toggleConnections',
    title: 'Toggle connections',
    description: 'Draw or hide the links between nodes in the graph.',
    keywords: ['links', 'edges', 'graph'],
    group: 'Visualization',
    enabled: (ctx) => hasSetting(ctx, 'showConnections'),
    run: (ctx) => toggleSetting(ctx, 'showConnections')
  },
  {
    id: 'viz.toggleTagGlow',
    title: 'Toggle tag glow',
    description: 'Tint each node by its tags.',
    keywords: ['colour', 'color', 'tags', 'graph'],
    group: 'Visualization',
    enabled: (ctx) => hasSetting(ctx, 'showTagsGlow'),
    run: (ctx) => toggleSetting(ctx, 'showTagsGlow')
  },
  {
    id: 'overlay.search',
    title: 'Search notes',
    description: 'Find a note by title, tag or text, and open it.',
    keywords: ['find', 'open', 'go to'],
    group: 'Navigation',
    defaultKeys: ['Mod+k', '/'],
    // `toggle`, not `open`, so the shortcut closes what it opened. From the
    // palette the two are the same: it closes itself before running.
    run: (ctx) => ctx.overlay.toggle('search')
  },
  {
    id: 'overlay.filter',
    title: 'Filter notes',
    description: 'Restrict the graph to the notes matching a query.',
    keywords: ['restrict', 'narrow', 'graph'],
    group: 'Navigation',
    defaultKeys: ['Mod+Shift+f'],
    run: (ctx) => ctx.overlay.toggle('filter')
  },
  {
    id: 'filter.clear',
    title: 'Clear filter',
    description: 'Drop the current filter and show the whole graph again.',
    keywords: ['reset', 'show all'],
    group: 'Navigation',
    // Closing the filter overlay does not clear the filter, so this is the one
    // command that undoes it from anywhere.
    enabled: (ctx) => ctx.values.filter.text !== '',
    run: (ctx) => ctx.filter.clear()
  },
  {
    id: 'overlay.commands',
    title: 'Command palette',
    description: 'Open or close the command palette.',
    group: 'Navigation',
    defaultKeys: ['Mod+Shift+p'],
    palette: false,
    run: (ctx) => ctx.overlay.toggle('commands')
  },
  {
    id: 'overlay.close',
    title: 'Close overlay',
    description: 'Close search, filter, the palette or settings.',
    group: 'Navigation',
    defaultKeys: ['Escape'],
    allowInInput: true,
    palette: false,
    // Disabled with nothing open, so the key is left alone — Escape means
    // something to plenty of other controls.
    enabled: (ctx) => ctx.values.overlay.kind !== null,
    run: (ctx) => ctx.overlay.close()
  },
  {
    id: 'overlay.settings',
    title: 'Open settings',
    description: 'Preferences and keyboard shortcuts.',
    keywords: ['preferences', 'options', 'config'],
    group: 'Navigation',
    run: (ctx) => ctx.overlay.toggle('settings')
  },
  {
    id: 'overlay.shortcuts',
    title: 'Edit keyboard shortcuts',
    description: 'Rebind the key for any command.',
    keywords: ['keys', 'keybindings', 'hotkeys', 'settings'],
    group: 'Navigation',
    run: (ctx) => ctx.overlay.toggle('shortcuts')
  }
];

/**
 * One "Show <label>" command per visualization, generated from the
 * descriptors so a new visualization gets its command without an edit here.
 *
 * Generated rather than imported: `viz/registry.js` pulls in Svelte components,
 * and the state layer — which needs every command id, or `shortcuts.js` drops a
 * binding to one as unknown — must not depend on them. `WithAppState` is handed
 * the descriptors anyway, so it builds the full list with `buildCommands`.
 *
 * Always enabled: on the active visualization it still reveals the pane, and
 * that is the one useful thing it can do there.
 *
 * @param {{id: string, label: string}[]} descriptors
 * @returns {Command[]}
 */
export function vizCommands(descriptors) {
  return descriptors.map((d) => ({
    id: `viz.show.${d.id}`,
    title: `Show ${d.label}`,
    description: `Switch the visualization pane to the ${d.label.toLowerCase()}.`,
    keywords: ['switch', 'visualization', 'graph'],
    group: /** @type {const} */ ('Visualization'),
    // In `content` mode the pane is hidden, and switching what it shows would
    // look like nothing happened. `viz` and `split` already show it.
    run: (ctx) => {
      ctx.viz.setActive(d.id);
      if (ctx.values.layout.mode === 'content') ctx.layout.setMode('split');
    }
  }));
}

/**
 * The full vocabulary: the static commands with the generated ones placed
 * after the last Visualization command, so the palette's empty-query order
 * stays grouped. Published as the `COMMANDS` context by `WithAppState`.
 *
 * @typedef {{list: Command[], byId: Map<string, Command>}} Commands
 *
 * @param {{id: string, label: string}[]} descriptors
 * @returns {Commands}
 */
export function buildCommands(descriptors) {
  let at = commands.length;
  commands.forEach((c, i) => {
    if (c.group === 'Visualization') at = i + 1;
  });
  const list = [...commands.slice(0, at), ...vizCommands(descriptors), ...commands.slice(at)];
  return { list, byId: new Map(list.map((command) => [command.id, command])) };
}
