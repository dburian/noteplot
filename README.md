# Noteplot

Visualization tool for Markdown notes. **Very alpha version.**

The goal of this repo is to render a html visualizations of markdown notes in
the browser. The tool should provide more insight, better UX when exploring your
notes and a platform with which you can present your own personal note
collection.

Currently, there is a lot of features missing, however, it is enough for my
personal use.

## Usage

Currently there is no npm package. So you need to:

1. Clone the repo
2. Run both in separate terminals

```bash
npm run watch:notes '<path to root note folder>'
npm run watch:vite
```

## TODOs

### 1.0

- [ ] suggestions for search bar
- [x] filling in active filter string
- [x] keyboard shortcuts
- [x] colored toolbar buttons w/ on/off + hovered styling
- [x] toolbar labels
- [x] toolbar resize on line, not button
- [x] search string to url
- [x] filter string to url
- [ ] mobile version of it all

### Ideas

- [x] refactor loading of search index jsons
  - [x] lazy load them (perhaps even in `minisearch` index form)
  - [x] have global available index
  - [x] do not have `/search` or `/filter` in url, only the search params?
- [ ] helpers for tailwind classes?
- [ ] documentation
- [ ] typescript (or learn to write better jsdoc)
- [ ] svelte 5 (down the line)
- [x] date graph
- [ ] graph transformations to url params (so go back and forward in history)
- [x] shallow routing for content slider searchParams
- [x] add access date and creation date to dates
- [x] graph controls
  - [ ] activate/deactivate force simulation
- [x] commandline for full keyboard experience

#### Desktop

- [x] the graph does not shift when the content pane opens or closes: it is laid out against the
      whole body row, so the pane covers part of it and you pan to what is underneath. (This
      replaces the earlier idea of shifting the graph to keep the active note visible.)
