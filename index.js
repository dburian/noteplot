#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { createServer, build as viteBuild } from 'vite';
import { preprocess } from './preprocessor/index.js';
import { logger } from './preprocessor/log.js';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// The site lives in this package, not in whatever directory the user happens to
// be standing in, so every path we hand the preprocessor is resolved against the
// package root.
const SAVE_PATH = path.join(__dirname, 'src/lib/generated/');
const IMG_SAVE_PATH = path.join(__dirname, 'static/note_imgs/');
// Parsed notes and graph positions, kept between runs. Disposable: deleting it
// costs one slow start.
const CACHE_PATH = path.join(__dirname, '.cache/noteplot/');

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * Reads the options, resolves the note directory, and puts us in the package.
 *
 * The order is the point. `noteRoot` comes from the user, so it has to be
 * resolved against **their** CWD; everything afterwards -- vite's config,
 * SvelteKit's `svelte.config.js` and `kit.files.*`, the preprocessor's output
 * -- belongs to the package. SvelteKit resolves its own config from
 * `process.cwd()` and offers no way to override that, so `chdir` is the only
 * way `noteplot` can be run from another directory at all (ISSUES.md A12).
 */
function setupCommonOpts(noteRoot, command) {
  const opts = command.optsWithGlobals();

  if (LOG_LEVELS.includes(opts.logLevel)) {
    logger.level = opts.logLevel;
  } else {
    logger.warn(
      `Unknown log level '${opts.logLevel}'. Keeping '${logger.level}'. Known levels: ${LOG_LEVELS.join(', ')}.`
    );
  }

  const absNoteRoot = path.resolve(noteRoot);
  process.chdir(__dirname);

  return { opts, noteRoot: absNoteRoot };
}

async function watch(noteRootArg, options, command) {
  const { opts, noteRoot } = setupCommonOpts(noteRootArg, command);

  if (!opts.onlyNotes) {
    // No `root`: SvelteKit enforces `root: process.cwd()` and warns about any
    // value we pass, so `setupCommonOpts`'s `chdir` is the only way to point
    // vite at the package. `server.host` is *not* enforced that way, so unlike
    // `base` and `root` it really does reach vite -- `undefined` (no `--host`)
    // leaves vite on its localhost-only default, `true` (bare `--host`) binds
    // every interface.
    const viteServer = await createServer({
      server: {
        host: opts.host,
        port: opts.port
      }
    });

    logger.info('Starting Vite dev server');
    await viteServer.listen();

    viteServer.printUrls();
    viteServer.bindCLIShortcuts({ print: true });
  }

  const noteCount = await preprocess({
    watch: true,
    savePath: SAVE_PATH,
    imgSavePath: IMG_SAVE_PATH,
    imgUrl: '/note_imgs/',
    cachePath: CACHE_PATH,
    noteRoot
  });

  // Only a warning here: notes may appear later, and the watcher picks them up.
  if (noteCount == 0) {
    logger.warn(`No Markdown files found under ${noteRoot}. Waiting for notes to appear.`);
  }
}

async function build(noteRootArg, options, command) {
  const { opts, noteRoot } = setupCommonOpts(noteRootArg, command);

  const noteCount = await preprocess({
    watch: false,
    savePath: SAVE_PATH,
    imgSavePath: IMG_SAVE_PATH,
    imgUrl: `${opts.basePath}/note_imgs/`,
    cachePath: CACHE_PATH,
    noteRoot
  });

  // Both `[slug]` routes are prerendered from the notes on disk and
  // `adapter-static` runs with `strict: true`, so with nothing to prerender vite
  // fails deep inside the build with a message about uncrawled routes. Say it
  // here instead, where we know why (ISSUES.md A18).
  if (noteCount == 0) {
    logger.error(
      `No Markdown files found under ${noteRoot} -- nothing to build. If the collection is not empty, the log above says why its notes were skipped.`
    );
    process.exitCode = 1;
    return;
  }

  if (opts.basePath) {
    // `svelte.config.js` reads this, and it is the only channel that works:
    // vite's own `base` is in SvelteKit's `enforced_config`, so passing it here
    // would be overridden and warned about. `root` is enforced the same way --
    // see the note in `watch`.
    process.env.BASE_PATH = opts.basePath;
  }

  await viteBuild();
}

async function main() {
  const prog = new Command();

  prog
    .name('noteplot')
    .description('Visualization tool for your Markdown notes.')
    .option(
      '--log-level <level>',
      `Log level to hide/display logs. One of ${LOG_LEVELS.join(', ')}.`,
      'debug'
    )
    .option(
      '--host [address]',
      'Address for the dev server to bind to. A bare `--host` binds every interface. Only used by `watch`.'
    );

  prog
    .command('watch')
    .description('Runs local server and watches for changes.')
    .argument('<note-dir>', 'Root directory containing all notes and images.')
    .option(
      '-p, --port <port>',
      'Port to host the server on.',
      (value) => parseInt(value, 10),
      5173
    )
    .option('--only-notes', 'Only pre-process markdown files', false)
    .action(watch);

  prog
    .command('build')
    .description('Builds a static site.')
    .argument('<note-dir>', 'Root directory containing all notes and images.')
    .option(
      '--base-path <path>',
      'Base path of the built site. Defaults to reading from $BASE_PATH environment variable.',
      'BASE_PATH' in process.env ? process.env.BASE_PATH : ''
    )
    .action(build);

  await prog.parseAsync();
}

main();
