/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runImportExecutionHandoffFixtureWorker } from '../../testing/integration/import-execution-handoff-fixtures.js';

function bounded(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Fixture completion remained pending')), 100);
  })]).finally(() => clearTimeout(timer));
}

function detachedWorker(run) {
  return (callbacks) => ({ startWorkerRun: async () => {
    // The production worker starts detached work; observe this deliberate unit
    // task so the legacy adapter's error cannot crash the unit test process.
    Promise.resolve().then(() => run(callbacks)).catch(() => {});
  } });
}

test('the actual handoff fixture reports a rejected release adapter instead of leaving completion pending', async () => {
  const failure = new Error('Controlled release failure');
  const context = { runs: { releaseLease: async () => { throw failure; } }, handoff: {}, preparation: {}, store: {} };
  await assert.rejects(bounded(runImportExecutionHandoffFixtureWorker(context, { operationRunId: 'run', importCandidateId: 'candidate' }, {}, {
    createWorkerFn: detachedWorker((callbacks) => callbacks.releaseLease({ runId: 'run' })),
  })), (error) => error === failure);
});

test('the actual handoff fixture preserves a lifecycle adapter failure after releasing the worker', async () => {
  const failure = new Error('Controlled lifecycle failure'); const order = [];
  const context = { runs: {
    markRunStarted: async () => { throw failure; },
    releaseLease: async () => { order.push('released'); return true; },
  }, handoff: {}, preparation: {}, store: {} };
  await assert.rejects(bounded(runImportExecutionHandoffFixtureWorker(context, { operationRunId: 'run', importCandidateId: 'candidate' }, {}, {
    createWorkerFn: detachedWorker(async (callbacks) => {
      try { await callbacks.markRunStarted({ runId: 'run' }); }
      finally { await callbacks.releaseLease({ runId: 'run' }); }
    }),
  })), (error) => error === failure);
  assert.deepEqual(order, ['released']);
});

test('the actual handoff fixture finishes when no lease was acquired without calling release', async () => {
  const context = { runs: { acquireLease: async () => null, releaseLease: async () => assert.fail('No owned lease exists') },
    handoff: {}, preparation: {}, store: {} };
  await bounded(runImportExecutionHandoffFixtureWorker(context, { operationRunId: 'run', importCandidateId: 'candidate' }, {}, {
    createWorkerFn: detachedWorker(async (callbacks) => { await callbacks.acquireLease({ runId: 'run' }); }),
  }));
});
