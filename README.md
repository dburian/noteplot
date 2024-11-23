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

### Overall

- [ ] documentation
- [ ] typescript (or learn to write better jsdoc)
- [ ] svelte 5 (down the line)
- [ ] better search engine... [sample list](https://byby.dev/js-search-libraries)
  - [ ] suggestions
  - [ ] field search
  - [ ] reflect results in graph
- [x] more targeted updates -- don't go through all notes, just those that
  changed, updating everything begins to be slow

### Desktop

- [] shallow routing for content slider searchParams
- [x] content slider animations
- [x] active note to state, hovered note
- [x] theming with tailwind
- [x] nicer meta info for notes
  - [x] unique links
  - [x] add reading time with [reading-time](https://www.npmjs.com/package/reading-time)
  - [ ] add access date and creation date
- [x] nicer desktop buttons/toolbar
- [ ] keyboard shortcuts
- [ ] graph shift with content slider, so that active note is (almost) always visible
- [ ] graph controls
  - [ ] button to switch tag colors on/off + global tags colors
  - [ ] show connections
- [ ] search as a always-on filter
- [ ] date graph
- [ ] graph transformations to url params (so go back and forward in history)

### Mobile

- [ ] nice content slider
