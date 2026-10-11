/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createWorkerTaskLifecycle } from './worker-task-lifecycle.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Seal tick admission, then drain handoffs already admitted by those ticks. */
export function createOperationDispatcherLifetime({ executeTick, executeRun, stopTimer }) {
  const ticks = createWorkerTaskLifecycle({ execute: executeTick });
  const runs = createWorkerTaskLifecycle({ execute: input => executeRun(input.run) });
  let ticking = false;
  let closing;

  function tick() {
    if (closing) return Promise.resolve({ reason: 'stopped', skipped: true });
    if (ticking) return Promise.resolve({ reason: 'tick_in_progress', skipped: true });
    ticking = true;
    const pending = ticks.start({ runId: 'dispatch_tick' });
    void pending.then(() => { ticking = false; }, () => { ticking = false; });
    return pending;
  }

  function stopAndDrain() {
    if (closing) return closing;
    const completion = Promise.withResolvers();
    closing = completion.promise;
    let stopFailed = false;
    let stopFailure;
    let stopping;
    try { stopping = Promise.resolve(stopTimer()); }
    catch (error) { stopping = Promise.reject(error); }
    const observedStop = stopping.catch(error => { stopFailed = true; stopFailure = error; });
    const drain = withWorkerTaskCleanup(async () => {
      await withWorkerTaskCleanup(() => ticks.close(), () => observedStop);
      if (stopFailed) throw stopFailure;
    }, () => runs.close());
    void drain.then(completion.resolve, completion.reject);
    return closing;
  }

  return { tick, stopAndDrain, isClosing: () => Boolean(closing),
    launch: run => runs.start({ runId: run.id, run }) };
}
