/**
 * The virtual module `vite.config.js` builds out of the *resolved* Tailwind
 * config. It exists because canvas drawing cannot use CSS classes, so
 * `$lib/viz/force_graph/canvas_graph.js` reads the theme colours from here.
 *
 * Typed as a plain nested record rather than `tailwindcss`'s own `Config`:
 * what the plugin emits is `resolveConfig()`'s output run through
 * `JSON.stringify`, so every colour is a resolved string and the shorthand
 * forms in `tailwind.config.js` have already been expanded.
 *
 * This is its own file, and it deliberately has no imports or exports:
 * `src/app.d.ts` is a module (it ends in `export {}`), and a `declare module`
 * inside a module is an *augmentation* of an existing one, which a virtual
 * module is not. Putting it there fails with the very error it is meant to fix.
 */
declare module 'virtual:tailwind-config' {
  /** A `.light` / `.dark` pair, the shape of every Noteplot colour. */
  type ColorPair = { light: string; dark: string };

  const config: {
    theme: {
      colors: {
        /** The four families defined in `tailwind.config.js`'s `nc`. */
        front: ColorPair;
        back: ColorPair;
        emphasis: ColorPair;
        muted: ColorPair;
        /** Everything Tailwind ships: a string, or a scale keyed by weight. */
        [name: string]: string | ColorPair | Record<string, string>;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  export default config;
}
