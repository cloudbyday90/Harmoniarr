/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createFixtureGate, createFixtureWorkerObserver, waitForFixtureReady } from './fixture-lifecycle.js';

/** Register completion before launch; signal-bound callers must supply their lifecycle's track callback. */
export async function startLibraryScanFixtureWorker({ callbacks, run, signal,
  track, createWorkerFn = createLibraryScanWorker } = {}) {
  if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function')) throw new TypeError('Scan fixture signal must be an AbortSignal');
  const assertNotAborted = () => {
    if (signal?.aborted) throw signal.reason !== undefined ? signal.reason : new DOMException('The scan fixture was cancelled', 'AbortError');
  };
  assertNotAborted();
  if ((track !== undefined && typeof track !== 'function') || (signal && typeof track !== 'function')) {
    throw new TypeError('Signal-bound scan fixture work requires a lifecycle registration callback');
  }
  const observer = createFixtureWorkerObserver({ callbacks });
  const startup = createFixtureGate();
  const done = startup.promise.then(() => observer.finished);
  done.catch(() => {});
  try {
    track?.(done);
    assertNotAborted();
    const worker = createWorkerFn({ ...callbacks, ...observer.callbacks,
      ...(signal ? { isCancellationRequested: async (input) => signal.aborted
        || (typeof callbacks.isCancellationRequested === 'function' ? await callbacks.isCancellationRequested(input) : false) } : {}),
    });
    await worker.startWorkerRun(run);
    startup.release();
  } catch (error) {
    startup.abort(error);
    throw error;
  }
  return { done, waitForReady: (ready) => waitForFixtureReady({ ready, operation: done, signal }) };
}
