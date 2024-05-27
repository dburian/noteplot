#!/usr/bin/env node
import { Command } from "commander";
import pino from "pino";
import { createServer } from "vite";
import { preprocess } from "./unify_preprocess.js";
import {fileURLToPath} from "node:url";

const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function watch(noteDir, options, command) {
  const opts = command.optsWithGlobals()

  console.log({noteDir, options, opts})

  const viteServer = await createServer({
    root: __dirname,
    server: {
      port: opts.port,
    }
  })

  logger.debug("Starting Vite dev server")
  await viteServer.listen()

  viteServer.printUrls()
  viteServer.bindCLIShortcuts({print: true})

  await preprocess({
    watch: true,
    savePath: './src/lib/notes/',
    imgSavePath: './static/note_imgs/',
    imgUrl: '/note_imgs/',
  }, [noteDir])
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
    .action(watch)


  await prog.parseAsync()
}

main()
