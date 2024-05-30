#!/usr/bin/env node
import { Command } from "commander";
import pino from "pino";
import { createServer, build as viteBuild } from "vite";
import { preprocess } from "./unify_preprocess.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function setupCommonOpts(command) {
  const opts = command.optsWithGlobals()

  logger.level = opts.logLevel

  return opts;
}

async function watch(noteDir, options, command) {
  const opts = setupCommonOpts(command)

  if (!opts.onlyNotes) {
    const viteServer = await createServer({
      root: __dirname,
      server: {
        port: opts.port,
      }
    })

    logger.debug("Starting Vite dev server")
    await viteServer.listen()

    viteServer.printUrls()
    viteServer.bindCLIShortcuts({ print: true })
  }

  await preprocess({
    watch: true,
    savePath: './src/lib/notes/',
    imgSavePath: './static/note_imgs/',
    imgUrl: '/note_imgs/',
  }, [noteDir])
}

async function build(noteDir, options, command) {
  const opts = setupCommonOpts(command)

  await preprocess({
    watch: false,
    savePath: './src/lib/notes/',
    imgSavePath: './static/note_imgs/',
    imgUrl: `${opts.baseUrl}/note_imgs/`,
  }, [noteDir])

  const buildConfig = {}

  if (opts.baseUrl) {
    buildConfig.base = opts.baseUrl
    process.env.BASE_URL = opts.baseUrl
  }

  viteBuild(buildConfig)
}

async function main() {
  const prog = new Command()

  prog
    .name("noteplot")
    .description("Visualization tool for your Markdown notes.")
    .option("--log-level", "Log level to hide/display logs.", "warn")

  prog
    .command("watch")
    .description("Runs local server and watches for changes.")
    .argument("<note-dir>", "Root directory containing all notes and images.")
    .option("-p, --port", "Port to host the server on.", 5173)
    .option("--only-notes", "Only pre-process markdown files", false)
    .action(watch)

  prog
    .command("build")
    .description("Builds a static site.")
    .argument("<note-dir", "Root directory containing all notes and images.")
    .option("--base-url", "Base URL of the built site. Defaults to reading from $BASE_URL environment variable.", "BASE_URL" in process.env ? process.env.BASE_URL : "")
    .action(build)


  await prog.parseAsync()
}

main()
