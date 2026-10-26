import { Worker } from 'node:worker_threads';

/**
 * A fixed set of parse workers fed from one queue.
 *
 * Rendering a note is CPU-bound (MathJax and Shiki), so a `Promise.all` over
 * notes on the main thread runs them one after another anyway. Threads are the
 * only way to use more than one core.
 */
export class ParsePool {
  /**
   * @param {number} size
   * @param {{noteRoot: string, imgUrl: string}} parserConfig
   */
  constructor(size, parserConfig) {
    /** @type {{worker: Worker, busy: boolean}[]} */
    this.workers = [];
    /** @type {{absPath: string, source: string, resolve: Function, reject: Function}[]} */
    this.queue = [];
    /** @type {Map<number, {resolve: Function, reject: Function, slot: {worker: Worker, busy: boolean}}>} */
    this.pending = new Map();
    this.nextId = 0;

    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), {
        workerData: parserConfig
      });
      const slot = { worker, busy: false };
      worker.on('message', (message) => this._onMessage(message));
      // A worker that dies takes its in-flight note with it; reject that one
      // rather than leaving `parse` hanging for ever.
      // `busy` stays raised, which retires the slot. With every slot retired
      // nothing would ever drain the queue, so it is rejected too.
      worker.on('error', (error) => {
        slot.busy = true;
        for (const [id, job] of this.pending) {
          if (job.slot === slot) {
            this.pending.delete(id);
            job.reject(error);
          }
        }
        if (this.pending.size == 0) {
          for (const job of this.queue.splice(0)) job.reject(error);
        }
      });
      this.workers.push(slot);
    }
  }

  /**
   * @param {string} absPath
   * @param {string} source
   * @returns {Promise<{record: import('../types.js').NoteRecord, warnings: string[]}>}
   */
  parse(absPath, source) {
    return new Promise((resolve, reject) => {
      this.queue.push({ absPath, source, resolve, reject });
      this._dispatch();
    });
  }

  _dispatch() {
    for (const slot of this.workers) {
      if (this.queue.length == 0) return;
      if (slot.busy) continue;

      const { absPath, source, resolve, reject } = /** @type {any} */ (this.queue.shift());
      const id = this.nextId++;
      slot.busy = true;
      this.pending.set(id, { resolve, reject, slot });
      slot.worker.postMessage({ id, absPath, source });
    }
  }

  _onMessage({ id, ok, result, error }) {
    const job = this.pending.get(id);
    if (!job) return;

    this.pending.delete(id);
    job.slot.busy = false;
    if (ok) job.resolve(result);
    else job.reject(new Error(error));

    this._dispatch();
  }

  async close() {
    await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
  }
}
