import { parentPort, workerData } from 'node:worker_threads';

import { createParser } from './parse_note.js';

/*
 * One parse worker. The parser is built once, when the worker starts, and
 * reused for every note it is sent: MathJax and Shiki dominate start-up, so a
 * worker only pays off over many notes -- see `PARSE_POOL_THRESHOLD`.
 */

const parseNote = createParser(workerData);

parentPort?.on('message', async ({ id, absPath, source }) => {
  try {
    parentPort?.postMessage({ id, ok: true, result: await parseNote(absPath, source) });
  } catch (error) {
    parentPort?.postMessage({ id, ok: false, error: error?.stack ?? String(error) });
  }
});
