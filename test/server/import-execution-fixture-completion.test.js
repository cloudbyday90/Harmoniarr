/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { startImportExecutionFixtureWorker } from '../../testing/integration/import-execution-worker-fixture.js';
import { runImportExecutionHandoffFixtureWorker } from '../../testing/integration/import-execution-handoff-fixtures.js';

test('handoff fixture waits beyond observed release for actual returned execution', async () => {
  const gate = Promise.withResolvers(); const releasing = Promise.withResolvers(); let settled = false;
  const context = { runs: { releaseLease: async () => {} }, handoff: {}, preparation: {}, store: {} };
  const pending = runImportExecutionHandoffFixtureWorker(context, { operationRunId: 'owned', importCandidateId: 'candidate' }, {}, {
    createWorkerFn: input => ({ startWorkerRun: async () => {
      await input.releaseLease(); releasing.resolve(); return { completion: gate.promise };
    } }),
  });
  void pending.then(() => { settled = true; }); await releasing.promise;
  try {
    await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false);
    gate.resolve(); await pending; assert.equal(settled, true);
  } finally { gate.resolve(); await pending; }
});

test('execution failure rejects fixture completion before an unreachable release observer', async () => {
  for (const primary of [new Error('early execution'), null]) {
    const completion = Promise.reject(primary); void completion.catch(() => {});
    const job = await startImportExecutionFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
      createWorkerFn: () => ({ startWorkerRun: async () => ({ completion }) }) });
    await assert.rejects(job.done, error => error === primary);
  }
});

test('observed callback null remains primary after actual execution drains and fails', async () => {
  const gate = Promise.withResolvers();
  const job = await startImportExecutionFixtureWorker({ callbacks: { releaseLease: async () => { throw null; } }, run: { runId: 'owned' },
    createWorkerFn: input => ({ startWorkerRun: async () => { await input.releaseLease(); return { completion: gate.promise }; } }) });
  gate.reject(new Error('execution fallout')); await assert.rejects(job.done, error => error === null);
});

test('execution fixture registers completion before launch and cancellation drains returned work', async () => {
  const controller = new AbortController(); const gate = Promise.withResolvers(); let registered; let launched = false; let settled = false;
  const job = await startImportExecutionFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' }, signal: controller.signal,
    track: promise => { assert.equal(launched, false); registered = promise; },
    createWorkerFn: input => ({ startWorkerRun: async () => {
      launched = true; await input.releaseLease(); return { completion: gate.promise };
    } }),
  });
  assert.equal(job.done, registered); void job.done.then(() => { settled = true; }); controller.abort(null);
  try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); }
  finally { gate.resolve(); await job.done; }
});

test('execution fixture refuses invalid ownership/handle before reporting a completion certificate', async () => {
  await assert.rejects(startImportExecutionFixtureWorker({ signal: new AbortController().signal }), /registration callback/u);
  for (const completion of [null, 1, {}]) {
    await assert.rejects(startImportExecutionFixtureWorker({ callbacks: { releaseLease: async () => {} }, run: { runId: 'owned' },
      createWorkerFn: () => ({ startWorkerRun: async () => ({ completion }) }) }), /completion must be a promise/u);
  }
  const controller = new AbortController(); controller.abort(null); let launched = false;
  await assert.rejects(startImportExecutionFixtureWorker({ signal: controller.signal, track() {}, createWorkerFn: () => { launched = true; } }), error => error === null);
  assert.equal(launched, false);
});
