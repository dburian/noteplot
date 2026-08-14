# `src/lib` — components and state

> **Keep this file current.** The context table below is the load-bearing part of this file. If
> you add, rename, or remove a context key, update it in the same commit.

## State lives in Svelte contexts, not in a store module

There is no global store file. All shared state is created inside **provider components** and
handed down via `setContext`. Every provider follows the same shape:

```svelte
<script>
  // createThingState returns a custom store: { subscribe, update, ...named actions }
  const thing = createThingState();
  setContext('thingKey', thing);
</script>

<slot />
```

Consumers call `getContext('thingKey')` and use it as a store (`$thing`). The stores are
hand-rolled — they expose `subscribe` plus named action methods rather than a bare `set`.

### The five contexts

| Key                  | Provider                              | Shape                                                      | Consumers                                                                                               |
| -------------------- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `adaptive`           | `adaptive/WithAdaptiveContext.svelte` | `{mobile, desktop}`                                        | `Adaptive.svelte`                                                                                       |
| `filterState`        | `search/WithFilterContext.svelte`     | `{query, results}`                                         | `GraphCanvas`, `FilterWindow`                                                                           |
| `graphState`         | `graph/WithGraphState.svelte`         | `{activeNote, hoveredNote, showConnections, showTagsGlow}` | `GraphCanvas`, `WithHoverableLinks`, `MobileToolbar`, `CloseContent`, `ShowConnections`, `ShowTagsGlow` |
| `contentState`       | `content/WithContentState.svelte`     | `{hasContent, onlyContent, noContent}`                     | `ContentSlider`, `MobileGraphInterface`, `MobileToolbar`, `LargerContent`, `SmallerContent`             |
| `contentSliderState` | `ContentSlider.svelte`                | `{searchString, lastUrl, width, lastSetWidth}`             | `DesktopToolbar`, `LargerContent`, `SmallerContent`, `ResizeContent`                                    |

**Context keys are strings, and a typo fails silently.** `getContext` on an unknown key returns
`undefined`, and `{#if $store.foo}` on an undefined store just renders nothing. There is already
one live instance of this: `DesktopToolbar.svelte` guards on `$contentSlider.hasContent`, but
`hasContent` belongs to `contentState`, so the resize handle never renders (ISSUES.md B5). When
adding a consumer, verify the key against the table above.

A sixth key, `graphInterfaceState`, was removed — it had no provider left. If you find it in old
branches or commits, it maps onto `contentState` plus `contentSliderState`.

### How the content contexts relate

`contentState` is the source of truth for _whether_ content shows; `contentSliderState` is the
desktop-only _how wide_. They are bidirectionally synced by a reactive block in
`ContentSlider.svelte`, which is the trickiest state code in the repo:

- `contentState` is derived from the URL (`?onlyContent` / `?noContent`, plus `hasContent` from
  the pathname) and writes back to it with `replaceState`.
- `ContentSlider` watches `$contentState` and snaps `width` to `1.0`, `0.0`, or `lastSetWidth`.
- The slider's own `larger()` / `smaller()` / `confirmWidth()` call _back_ into `contentState`.

Changing one side without the other produces oscillation. `lastSetWidth` exists so that
collapsing and re-expanding restores the user's chosen width.

## Component tree

```
(graph)/+layout.svelte
└─ WithAdaptiveContext            media query → {mobile, desktop}
   └─ WithFilterContext
      └─ WithGraphState
         └─ WithContentState
            └─ Adaptive           picks one named slot; nothing renders before the
                                  media query resolves on mount
               ├─ DesktopGraphInterface (slot="desktop")
               │   ├─ GraphContainer → GraphCanvas      full-screen canvas, fixed, behind
               │   └─ ContentSlider                     right-hand pane, tweened width
               │       ├─ DesktopToolbar
               │       └─ Note → <slot/> → the route's +page.svelte
               └─ MobileGraphInterface (slot="mobile")
                   ├─ GraphContainer → GraphCanvas
                   ├─ MobileToolbar                     floating buttons, bottom-right
                   └─ full-screen overlay → <slot/>     shown when a note is active
                                                        and !$contentState.noContent
```

`Adaptive.svelte` renders **neither** slot until `WithAdaptiveContext`'s `MediaQuery` fires on
mount, because both `mobile` and `desktop` initialise to `false`. That is deliberate — it avoids
mounting the wrong interface during prerender — but it means nothing in the tree runs on the
server.

`Note.svelte` wraps the slot in `{#key $page.data?.note?.slug}`, so navigating between notes
destroys and rebuilds the whole subtree. Anything relying on `onMount` inside a note (such as
`WithHoverableLinks`) depends on this.

## Directories

### `note/`

Renders a loaded note JSON. `NoteContent.svelte` takes the note's fields as props and
`{@html content}`s the preprocessor's output inside `Prose`. `NoteMetaContent.svelte` is the
metadata block (references, backlinks, tags, reading time). `WithHoverableLinks.svelte` reaches
into the rendered HTML with `querySelectorAll('#note-content a[data-slug]')` and wires hover
events to `graphState`, so hovering a link in prose highlights the node in the graph — the
`data-slug` attribute is injected back in `unify_pipelines.js`'s `addLinks`.

`MobileNoteContainer.svelte` is a draggable bottom sheet. It is imported by `Note.svelte` but
**entirely commented out** — nothing currently mounts it. It is kept because it is the intended
home for the mobile note view described in `ISSUES.md` B7.

### `search/`

`search_index.js` exports `MiniSearchIndex`, the only index actually used. It wraps `minisearch`
over the `content`, `title`, and `tag` fields, and `parseSearchString` implements a small query
language: bare terms, quoted phrases, and `field:term` prefixes, all combined with `AND`.

Two windows, **deliberately separate** because they do different jobs:

- `SearchWindow.svelte` — keeps results in a local variable. Finding a note and jumping to it;
  the graph is untouched.
- `FilterWindow.svelte` — writes results into `filterState`, which `GraphCanvas` reads to
  restrict the visible nodes and links.

Both construct their own `MiniSearchIndex` on mount, and both call `search()` without awaiting
the index's async construction (ISSUES.md B3, B4).

### `toolbar/`

Three layers, each adding one concern:
`components/Button.svelte` (bare `<button>`, forwards events) →
`ToolbarButton.svelte` (active/default colour pair) →
`DesktopToolbarButton.svelte` (adds the tweened slide-out label).

`buttons/` holds one component per action. Each is self-contained: it pulls the contexts it
needs and decides its own visibility. Colour pairs are passed as Tailwind class strings
(`activeColor` / `defaultColor`), so they must be literal strings — Tailwind's content scanner
cannot see computed class names.

Note `DesktopToolbarButton`'s `$: active = hover != on` — hovering an "on" button renders it as
_inactive_. That inversion is intentional (hover previews the toggled state).

### `adaptive/`

`MediaQuery.svelte` is a renderless component that dispatches `change` with a boolean.
`WithAdaptiveContext` owns the breakpoint (`max-width: 639px`, matching Tailwind's `sm`) and
publishes the `adaptive` store. `Adaptive.svelte` is the slot switch.

### `components/`

`Button.svelte` and `InfoBox.svelte` — the only genuinely generic components.

## `Prose.svelte` and the max-width mechanism

Note width is controlled across _both halves of the app_. The preprocessor's
`rehypeWrapTextElems` plugin (`unify_pipelines.js`) wraps every top-level element except
`mjx-container` in `<div class="prose-high-level-tag">`; `Prose.svelte` gives that class
`max-width: 65ch; margin: auto`. The result is centred, readable text with maths and other wide
blocks allowed to overflow full-width.

So: **changing note text width means changing both the rehype plugin and `Prose.svelte`.**
`Prose` itself is otherwise just Tailwind typography config (`prose prose-noteplot
dark:prose-invert`).
