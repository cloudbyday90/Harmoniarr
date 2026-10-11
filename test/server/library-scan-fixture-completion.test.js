/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { startLibraryScanFixtureWorker } from '../../testing/integration/library-scan-worker-fixture.js';

test('scan fixture completion waits beyond the release callback for the returned execution promise', async () => {
  const gate = Promise.withResolvers(); let finished = false;
  const job = await startLibraryScanFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
    createWorkerFn: input => ({ startWorkerRun: async () => { await input.releaseLease(); return { completion: gate.promise }; } }) });
  void job.done.then(() => { finished = true; });
  try {
    await new Promise(resolve => { setImmediate(resolve); }); assert.equal(finished, false);
    gate.resolve(); await job.done; assert.equal(finished, true);
  } finally { gate.resolve(); await job.done; }
});

test('execution failure rejects fixture completion without waiting for an unreachable release observer', async () => {
  for (const primary of [new Error('early execution'), null]) {
    const completion = Promise.reject(primary); void completion.catch(() => {});
    const job = await startLibraryScanFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
      createWorkerFn: () => ({ startWorkerRun: async () => ({ completion }) }) });
    await assert.rejects(job.done, error => error === primary);
  }
});

test('earlier callback null failure wins over secondary execution failure after actual completion drains', async () => {
  const gate = Promise.withResolvers();
  const job = await startLibraryScanFixtureWorker({ callbacks: { releaseLease: async () => { throw null; } }, run: { runId: 'owned' },
    createWorkerFn: input => ({ startWorkerRun: async () => { await input.releaseLease(); return { completion: gate.promise }; } }) });
  void job.done.catch(() => {}); gate.reject(new Error('execution fallout'));
  await assert.rejects(job.done, error => error === null);
});
