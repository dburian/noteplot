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
- [ ] filling in active filter string
- [ ] keyboard shortcuts
- [x] colored toolbar buttons w/ on/off + hovered styling
- [x] toolbar labels
- [ ] toolbar resize on line, not button
- [ ] search string to url
- [ ] filter string to url
- [ ] mobile version of it all

### Ideas

- [ ] refactor loading of search index jsons
  - [ ] lazy load them (perhaps even in `minisearch` index form)
  - [ ] have global available index
  - [ ] do not have `/search` or `/filter` in url, only the search params?
- [ ] helpers for tailwind classes?
- [ ] documentation
- [ ] typescript (or learn to write better jsdoc)
- [ ] svelte 5 (down the line)
- [ ] date graph
- [ ] graph transformations to url params (so go back and forward in history)
- [ ] shallow routing for content slider searchParams
- [ ] add access date and creation date to dates
- [ ] graph controls
  - [ ] activate/deactivate force simulation
- [ ] commandline for full keyboard experience

#### Desktop

- [ ] graph shift with content slider, so that active note is (almost) always visible

