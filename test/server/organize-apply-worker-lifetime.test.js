/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryOrganizeApplyWorker } from '../../src/server/library/library-organize-apply-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const lease = () => createOperationRunLeaseFixture({ runId: 'organize', jobType: 'library_organize_apply' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), applyOrganizeMutation: async () => ({ transport: 'copy_then_remove' }),
    buildLibraryOrganizePreview: async () => ({ files: [] }), createExclusiveFileMutationPlan: async plan => plan,
    markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('organize coalesces a duplicate through held release with shared actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun({ runId: 'organize', plannedRenameCount: 0 }); await entered.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'organize', plannedRenameCount: 0 }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued organize acceptance propagates through its handler while close seals admission', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let completed = false;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ markRunStarted: async () => { entered.resolve(); await gate.promise; return true; },
    markRunCompleted: async () => { completed = true; return true; } }));
  const handlers = createOperationQueueHandlers({ libraryModule: { libraryOrganizeApplyWorker: worker } });
  const accepted = await handlers.library_organize_apply({ run: { id: 'organize', summary: { plannedRenameCount: 0 } } });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(completed, false); assert.equal(typeof accepted.completion.then, 'function');
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(completed, true);
});

for (const primary of [new Error('organize acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes with no unowned release`, async () => {
    const worker = createLibraryOrganizeApplyWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('Unowned failure must not update a run'),
      releaseLease: async () => assert.fail('Unowned acquisition must not release'),
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'organize' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });

  test(`failed organize persistence ${primary === null ? 'null' : 'Error'} survives renewal/release fallout`, async () => {
    let releases = 0;
    const worker = createLibraryOrganizeApplyWorker(callbacks({
      buildLibraryOrganizePreview: async () => { throw new Error('organize input'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('release fallout'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'organize' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(releases, 1);
  });
}

test('expected lease refusal/loss keeps domain and release policy', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createLibraryOrganizeApplyWorker(callbacks({ acquireLease: async () => { throw Object.assign(new Error('expected lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('No acquired lease may be marked failed'),
      releaseLease: async () => assert.fail('No acquired lease may be released'),
    }));
    await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
  }
});

test('null organize failure is persisted with its fixed fallback message', async () => {
  let message;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
  assert.equal(message, 'Library organize apply failed');
});

test('lease-coded failure after acquisition retains the owning domain outcome and captured release', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    let failed; let released;
    const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => {
      throw Object.assign(new Error('organize dependency lease outcome'), { code });
    }, markRunFailed: async input => { failed = input; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
    assert.deepEqual(released.expectedLease, lease());
    if (code === 'operation_run_lease_lost') { assert.equal(failed, undefined); assert.equal(released.status, 'failed'); }
    else { assert.equal(failed.errorMessage, 'organize dependency lease outcome'); assert.equal(released.status, 'failed'); }
  }
});

test('organize waits for actual admitted renewal before releasing the captured lease', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'organize' }); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('renewal drain failure still attempts lease release and remains primary', async () => {
  const primary = new Error('renewal drain'); let released = false;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ renewLease: async () => true,
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
    releaseLease: async () => { released = true; throw new Error('release fallout'); },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'organize' });
  await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});

const file = (id = 'file') => ({ fileId: id, libraryRootPath: '/owned', currentPath: '/owned/incoming.flac',
  proposedPath: '/owned/Artist/Album/track.flac', proposedRelativePath: 'Artist/Album/track.flac',
  match: { artistName: 'Artist', releaseTitle: 'Album' }, status: { code: 'rename_required' } });

test('admitted guarded mutation and both advisory callbacks remain owned beyond terminal persistence', { timeout: 10000 }, async t => {
  const mutationEntered = Promise.withResolvers(); const mutationGate = Promise.withResolvers();
  const notificationEntered = Promise.withResolvers(); const notificationGate = Promise.withResolvers();
  const activityEntered = Promise.withResolvers(); const activityGate = Promise.withResolvers();
  let completed; let released = false;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => ({ files: [file()] }),
    applyOrganizeMutation: async input => { assert.deepEqual(input.expectedLease, lease()); mutationEntered.resolve(); await mutationGate.promise;
      return { transport: 'copy_then_remove' }; },
    markRunCompleted: async input => { completed = input; return true; }, releaseLease: async () => { released = true; },
    onReleaseAddedFn: async input => { assert.equal(input.movedCount, 1); notificationEntered.resolve(); await notificationGate.promise; throw null; },
    recordActivityEventFn: async () => { activityEntered.resolve(); await activityGate.promise; throw new Error('advisory'); },
    markRunFailed: async () => assert.fail('Best-effort callback failure must not fail persisted movement'),
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'organize', plannedRenameCount: 1 }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: mutationEntered.promise, operation: completion, signal: t.signal });
    assert.equal(completed, undefined); assert.equal(released, false); mutationGate.resolve();
    await waitForFixtureReady({ ready: Promise.all([notificationEntered.promise, activityEntered.promise]), operation: completion, signal: t.signal });
    assert.equal(completed.summary.movedCount, 1); assert.equal(released, false);
    notificationGate.resolve(); await flush(); assert.equal(released, false);
    activityGate.resolve(); await completion; await closing; assert.equal(released, true);
  } finally { mutationGate.resolve(); notificationGate.resolve(); activityGate.resolve(); await completion; await closing; }
});

test('plain returns and synchronous advisory null failures preserve successful domain movement', async () => {
  let callbacksCalled = 0; let completed;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => ({ files: [file()] }),
    onReleaseAddedFn: () => { callbacksCalled++; throw null; }, recordActivityEventFn: () => { callbacksCalled++; },
    markRunCompleted: async input => { completed = input; return true; },
    markRunFailed: async () => assert.fail('Synchronous advisory failure must stay best-effort'),
  }));
  await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
  assert.equal(callbacksCalled, 2); assert.equal(completed.summary.movedCount, 1);
});

test('partial movement keeps failed/not-attempted results and drains its eligible moved-release callbacks', async () => {
  let completed; const attempted = []; const notices = [];
  const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => ({ files: [file('first'), file('second'), file('third')] }),
    applyOrganizeMutation: async input => { attempted.push(input.file.fileId); if (input.file.fileId === 'second') throw null;
      return { transport: 'copy_then_remove' }; },
    markRunCompleted: async input => { completed = input; return true; }, onReleaseAddedFn: async input => { notices.push(input); },
  }));
  await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
  assert.deepEqual(attempted, ['first', 'second']); assert.equal(completed.summary.movedCount, 1);
  assert.deepEqual(completed.summary.fileResults.map(value => value.status), ['moved', 'failed', 'not_attempted']);
  assert.equal(notices.length, 1); assert.equal(notices[0].movedCount, 1);
});

test('rejected terminal persistence does not admit advisory callbacks and releases with failed status', async () => {
  let released; let callbacksCalled = 0;
  const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => ({ files: [file()] }),
    markRunCompleted: async () => false,
    onReleaseAddedFn: () => { callbacksCalled++; },
    recordActivityEventFn: () => { callbacksCalled++; },
    releaseLease: async input => { released = input; },
  }));
  await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close();
  assert.equal(released.status, 'failed'); assert.equal(callbacksCalled, 0);
});

for (const fails of [false, true]) {
  test(`no ${fails ? 'successful' : 'planned'} moves admit no diagnostic callbacks`, async () => {
    let callbacksCalled = 0;
    const worker = createLibraryOrganizeApplyWorker(callbacks({ buildLibraryOrganizePreview: async () => ({ files: fails ? [file()] : [] }),
      applyOrganizeMutation: async () => { throw new Error('file refusal'); },
      onReleaseAddedFn: () => { callbacksCalled++; }, recordActivityEventFn: () => { callbacksCalled++; },
    }));
    await (await worker.startWorkerRun({ runId: 'organize' })).completion; await worker.close(); assert.equal(callbacksCalled, 0);
  });
}

test('failed organize release rejects actual completion and canonical close unchanged', async () => {
  const primary = new Error('organize release');
  const worker = createLibraryOrganizeApplyWorker(callbacks({ releaseLease: async () => { throw primary; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'organize' }); await assert.rejects(completion, error => error === primary);
  const closing = worker.close(); assert.equal(worker.close(), closing); await assert.rejects(closing, error => error === primary);
});
