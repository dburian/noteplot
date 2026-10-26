import pino from 'pino';

/**
 * The one logger for the CLI and the preprocessor. `index.js` sets its level
 * from `--log-level`; before this was shared the preprocessor kept its own
 * logger pinned at `debug`, so the flag only ever reached the CLI's messages.
 *
 * Never import this from `parse/`: that code also runs in worker threads, and
 * every pino transport is a thread of its own. Parse warnings travel back to
 * the main thread as data and are logged here.
 */
export const logger = pino({
  transport: {
    target: 'pino-pretty'
  },
  level: 'debug'
});
