/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
function callbacks(overrides = {}) {
  return { acquireLease: async () => createOperationRunLeaseFixture({ runId: 'scan', jobType: 'library_scan' }),
    executeScan: async () => ({ libraryRoot: '/owned', filesSeen: 0 }),
    recordLibraryScanCatalogue: async () => ({ files: [], observedFileCount: 0 }),
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('scan stays coalesced through a held final release and shares actual completion', async () => {
  const releasing = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const input = callbacks({ acquireLease: async () => { acquisitions++; return createOperationRunLeaseFixture({ runId: 'scan', jobType: 'library_scan' }); },
    releaseLease: async () => { releasing.resolve(); await gate.promise; } });
  const worker = createLibraryScanWorker(input); const first = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' });
  await releasing.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
    const closing = worker.close(); assert.equal(worker.close(), closing);
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
    gate.resolve(); await first.completion; await closing;
  } finally { gate.resolve(); await first?.completion; await second?.completion; await flush(); }
});

for (const primary of [new Error('scan primary'), null]) {
  test(`scan acquisition retains an escaping ${primary === null ? 'null' : 'Error'}`, async () => {
    let releases = 0;
    const worker = createLibraryScanWorker(callbacks({ acquireLease: async () => { throw primary; },
      releaseLease: async () => { releases++; } }));
    const { completion } = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' });
    await assert.rejects(completion, error => error === primary);
    await assert.rejects(worker.close(), error => error === primary); assert.equal(releases, 0);
  });

  test(`escaping scan ${primary === null ? 'null' : 'Error'} wins over renewal and lease cleanup failures`, async () => {
    let releases = 0;
    const worker = createLibraryScanWorker(callbacks({
      renewLease: async () => true, markRunStarted: async () => { throw new Error('domain failure'); },
      markRunFailed: async () => { throw primary; },
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('lease cleanup'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' });
    await assert.rejects(completion, error => error === primary);
    await assert.rejects(worker.close(), error => error === primary); assert.equal(releases, 1);
  });
}

test('scan final release waits for an actual admitted heartbeat renewal', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createLibraryScanWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async () => { released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' });
  const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('a null domain failure is persisted without a secondary error-message TypeError', async () => {
  let message;
  const worker = createLibraryScanWorker(callbacks({ executeScan: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'scan', libraryRoot: '/owned' });
  await completion; await worker.close(); assert.equal(message, 'Library scan failed');
});
