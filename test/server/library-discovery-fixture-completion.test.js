/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { startLibraryDiscoveryFixtureWorker } from '../../testing/integration/library-discovery-worker-fixture.js';

test('discovery fixture waits beyond release observation for actual completion through pruning', async () => {
  const gate = Promise.withResolvers(); let settled = false;
  const job = await startLibraryDiscoveryFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
    createWorkerFn: input => ({ startWorkerRun: async () => { await input.releaseLease(); return { completion: gate.promise }; } }),
  });
  void job.done.then(() => { settled = true; });
  try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); }
  finally { gate.resolve(); await job.done; }
});

test('discovery failure rejects fixture completion before an unreachable release observer', async () => {
  for (const primary of [new Error('early discovery'), null]) {
    const completion = Promise.reject(primary); void completion.catch(() => {});
    const job = await startLibraryDiscoveryFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
      createWorkerFn: () => ({ startWorkerRun: async () => ({ completion }) }) });
    await assert.rejects(job.done, error => error === primary);
  }
});

test('observed callback null remains primary after actual discovery drains and fails', async () => {
  const gate = Promise.withResolvers();
  const job = await startLibraryDiscoveryFixtureWorker({ callbacks: { releaseLease: async () => { throw null; } }, run: { runId: 'owned' },
    createWorkerFn: input => ({ startWorkerRun: async () => { await input.releaseLease(); return { completion: gate.promise }; } }) });
  gate.reject(new Error('discovery fallout')); await assert.rejects(job.done, error => error === null);
});

test('discovery fixture registers completion before launch and cancellation drains returned work', async () => {
  const controller = new AbortController(); const gate = Promise.withResolvers(); let registered; let launched = false; let settled = false;
  const job = await startLibraryDiscoveryFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' }, signal: controller.signal,
    track: promise => { assert.equal(launched, false); registered = promise; },
    createWorkerFn: input => ({ startWorkerRun: async () => {
      launched = true; await input.releaseLease(); return { completion: gate.promise };
    } }),
  });
  assert.equal(job.done, registered); void job.done.then(() => { settled = true; }); controller.abort(null);
  try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); }
  finally { gate.resolve(); await job.done; }
});

test('discovery fixture refuses invalid ownership/handle before reporting a completion certificate', async () => {
  await assert.rejects(startLibraryDiscoveryFixtureWorker({ signal: new AbortController().signal }), /registration callback/u);
  for (const completion of [null, 1, {}]) {
    await assert.rejects(startLibraryDiscoveryFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
      createWorkerFn: () => ({ startWorkerRun: async () => ({ completion }) }) }), /completion must be a promise/u);
  }
  const controller = new AbortController(); controller.abort(null); let launched = false;
  await assert.rejects(startLibraryDiscoveryFixtureWorker({ signal: controller.signal, track() {}, createWorkerFn: () => { launched = true; } }), error => error === null);
  assert.equal(launched, false);
});
