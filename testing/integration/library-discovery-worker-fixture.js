/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createFixtureGate, createFixtureWorkerObserver } from './fixture-lifecycle.js';

/** Register actual execution before launch; legacy injected doubles retain callback observation. */
export async function startLibraryDiscoveryFixtureWorker({ callbacks, run, signal, track,
  createWorkerFn = createLibraryDiscoveryWorker } = {}) {
  if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function')) throw new TypeError('Discovery fixture signal must be an AbortSignal');
  const assertNotAborted = () => {
    if (signal?.aborted) throw signal.reason !== undefined ? signal.reason : new DOMException('The discovery fixture was cancelled', 'AbortError');
  };
  assertNotAborted();
  if ((track !== undefined && typeof track !== 'function') || (signal && typeof track !== 'function')) {
    throw new TypeError('Signal-bound discovery fixture work requires a lifecycle registration callback');
  }
  const observer = createFixtureWorkerObserver({ callbacks });
  const startup = createFixtureGate();
  let completion; let callbackFailed = false; let callbackFailure;
  void observer.finished.catch(error => { callbackFailed = true; callbackFailure = error; });
  const done = startup.promise.then(async () => {
    if (completion) {
      try { await completion; }
      catch (error) { throw callbackFailed ? callbackFailure : error; }
    }
    return observer.finished;
  });
  void done.catch(() => {});
  try {
    track?.(done);
    assertNotAborted();
    const worker = createWorkerFn({ ...callbacks, ...observer.callbacks,
      ...(signal ? { isCancellationRequested: async input => signal.aborted
        || (typeof callbacks.isCancellationRequested === 'function' ? await callbacks.isCancellationRequested(input) : false) } : {}),
    });
    const accepted = await worker.startWorkerRun(run);
    completion = accepted?.completion;
    if (completion !== undefined && (completion === null || typeof completion.then !== 'function')) {
      throw new TypeError('Discovery fixture completion must be a promise');
    }
    if (createWorkerFn === createLibraryDiscoveryWorker && completion === undefined) {
      throw new TypeError('The discovery worker must supply actual completion');
    }
    startup.release();
  } catch (error) {
    startup.abort(error);
    throw error;
  }
  return { done };
}
