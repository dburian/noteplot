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

- [] documentation
- [] typescript (do typing properly)
- [] svelte 5

### Desktop

- [] shallow routing for content slider searchParams
- [x] content slider animations
- [] active note to state, hovered note
- [] nicer meta info for notes
- [] nicer desktop buttons/toolbar
- [] graph shift with content slider, so that active note is (almost) always visible
- [] button to switch tag colors on/off
- [] date graph
