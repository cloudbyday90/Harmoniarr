import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createExecutionWorkerHarness, executionCandidate } from '../../testing/server/import-execution-worker-harness.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createImportCandidateExecutionConfirmationWorklistService } from '../../src/server/import-candidates/import-candidate-execution-confirmation-worklist-service.js';

function checkpoint(candidate, { receipt = false, attempt = true, runId = 'run-1' } = {}) {
  const requestedFiles = candidate.files.filter((file) => !file.isLocked).map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  let saved = attempt ? createDownloadAttempt({ importCandidateId: candidate.id, operationRunId: runId,
    requestedFiles, username: candidate.username, sourceObservation: captureRecoveryObservation(candidate) }) : null;
  if (receipt) saved = evaluateDownloadReceipt({ attempt: saved, enqueueResult: {
    enqueued: requestedFiles.map((file) => ({ ...file, username: candidate.username, id: randomUUID() })), failed: [],
  } }).attempt;
  return { id: randomUUID(), importCandidateId: candidate.id, operationRunId: runId, position: 1,
    itemStatus: 'awaiting_confirmation', planningSnapshot: { candidate,
      execution: { sourceObservation: captureRecoveryObservation(candidate), requestedFiles,
        handoff: { state: 'dispatching', ...(saved ? { attempt: saved } : {}) } } },
  };
}

function assertCompleted(harness) {
  assert.equal(harness.marks.failed, null, harness.marks.failed?.errorMessage);
  assert.ok(harness.marks.completed);
  return harness.marks.completed.summary;
}

test('execution records full exact receipts and leaves blocked candidates undispatched', async (t) => {
  const ready = executionCandidate();
  const blocked = executionCandidate({ id: 'blocked', executionStatus: { code: 'blocked', message: 'Configure the folder mapping.' } });
  const harness = createExecutionWorkerHarness(t, { candidates: [ready, blocked] });
  await harness.run();
  const summary = assertCompleted(harness);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
  assert.equal(harness.transitionDownloading.mock.callCount(), 1);
  assert.equal(harness.candidateRows.get(ready.id).status, 'downloading');
  assert.equal(harness.items.get(ready.id).itemStatus, 'queued');
  assert.equal(harness.items.get(blocked.id).itemStatus, 'blocked');
  assert.equal(harness.items.get(ready.id).planningSnapshot.execution.diagnostics.downloadAcceptance.code, 'provider_accepted');
  assert.equal(harness.recordConfirmedTransfers.mock.callCount(), 1);
  assert.equal(harness.recordConfirmedTransfers.mock.calls[0].arguments[0].transfers.length, 1);
  assert.equal(summary.queuedCount, 1);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.awaitingConfirmationCount, 0);
});

test('a manually selected run only posts its chosen candidate', async (t) => {
  const harness = createExecutionWorkerHarness(t, { candidates: [executionCandidate(), executionCandidate({ id: 'other' })] });
  await harness.run({ selectedCandidateId: 'candidate-1', requestedCandidateCount: 1 });
  assertCompleted(harness);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
  assert.deepEqual(harness.buildSelectedImportCandidateSummary.mock.calls[0].arguments[0].candidateIds, ['candidate-1']);
  assert.equal(harness.candidateRows.get('other').status, 'selected');
  assert.equal(harness.items.has('other'), false);
});

test('another worker lease leaves the run and provider untouched', async (t) => {
  const acquireLease = t.mock.fn(async () => { throw Object.assign(new Error('Lease held'), { code: 'operation_run_lease_unavailable' }); });
  const markRunStarted = t.mock.fn(async () => {});
  const markRunFailed = t.mock.fn(async () => {});
  const releaseLease = t.mock.fn(async () => {});
  const enqueueDownloads = t.mock.fn(async () => {});
  const worker = createImportCandidateExecutionWorker({ acquireLease, markRunStarted, markRunFailed, releaseLease, enqueueDownloads });
  await worker.startWorkerRun({ requestedCandidateCount: 1, runId: 'held' });
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(acquireLease.mock.callCount(), 1);
  for (const effect of [markRunStarted, markRunFailed, releaseLease, enqueueDownloads]) assert.equal(effect.mock.callCount(), 0);
});

test('maintenance pauses before initialization or any provider work', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    isCancellationRequested: async () => ({ kind: 'paused', nextRetryAt: '2026-10-09T03:00:00.000Z',
      pauseCode: 'recovery_lock_conflict', pauseMessage: 'Restore in progress.', pauseProvider: 'restore' }),
  } });
  const released = await harness.run();
  assert.equal(released.status, 'paused');
  assert.equal(harness.marks.paused.summary.pauseCode, 'recovery_lock_conflict');
  assert.equal(harness.marks.completed, null);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.initializeImportExecutionRunItems.mock.callCount(), 0);
});

test('a definitive all-file refusal may continue to a different recovery candidate', async (t) => {
  const next = executionCandidate({ id: 'next', username: 'next-peer' });
  const harness = createExecutionWorkerHarness(t, {
    enqueue: async ({ files, username }) => username === 'peer'
      ? { enqueued: [], failed: files.map((file) => file.filename) }
      : { enqueued: files.map((file) => ({ ...file, username, id: randomUUID(), state: 'Queued' })), failed: [] },
    workerOverrides: { handleImportCandidateDownloadFailure: async () => {
      harness.candidateRows.set(next.id, next);
      return { recovered: true, nextCandidateId: next.id };
    } },
  });
  await harness.run();
  const summary = assertCompleted(harness);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 2);
  assert.equal(harness.candidateRows.get('candidate-1').status, 'failed');
  assert.equal(harness.candidateRows.get('next').status, 'downloading');
  assert.equal(summary.queueFailedCount, 1);
  assert.equal(summary.queuedCount, 1);
  assert.equal(summary.recoveredCandidateCount, 1);
});

test('no unlocked files are diagnosed before dispatch', async (t) => {
  const harness = createExecutionWorkerHarness(t, { candidates: [executionCandidate({ files: [] })] });
  await harness.run();
  assert.equal(assertCompleted(harness).blockedCount, 1);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.diagnostics.downloadAcceptance.code, 'no_unlocked_files');
});

test('resuming a durable full receipt confirms through the owner without a second POST', async (t) => {
  const candidate = executionCandidate();
  const saved = checkpoint(candidate, { receipt: true });
  const harness = createExecutionWorkerHarness(t, { candidates: [candidate], existingItems: [saved] });
  await harness.run();
  assert.equal(assertCompleted(harness).awaitingConfirmationCount, 0);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.transitionDownloading.mock.callCount(), 1);
  assert.equal(harness.items.get(candidate.id).planningSnapshot.execution.handoff.state, 'confirmed');
  assert.equal(harness.items.get(candidate.id).planningSnapshot.execution.handoff.attempt.attemptId,
    saved.planningSnapshot.execution.handoff.attempt.attemptId);
});

for (const legacy of [false, true]) {
  test(`an unknown ${legacy ? 'legacy' : 'attempt-owned'} handoff cannot be confirmed by a history matcher`, async (t) => {
    const candidate = executionCandidate();
    const harness = createExecutionWorkerHarness(t, { candidates: [candidate], existingItems: [checkpoint(candidate, { attempt: !legacy })],
      workerOverrides: { findMatchingTransfers: async () => ({ allRequestedFilesMatched: true, disposition: 'confirmed',
        matchedTransfers: [{ ...candidate.files[0], id: randomUUID(), username: candidate.username }], requestedFileCount: 1 }) },
    });
    await harness.run();
    assert.equal(assertCompleted(harness).awaitingConfirmationCount, 1);
    assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
    assert.equal(harness.transitionDownloading.mock.callCount(), 0);
    assert.equal(harness.candidateRows.get(candidate.id).status, 'selected');
    assert.equal(harness.items.get(candidate.id).itemStatus, 'awaiting_confirmation');
  });
}

test('partial acceptance retains exact identities but does not advance or resend the request', async (t) => {
  const candidate = executionCandidate();
  candidate.files.push({ ...candidate.files[0], id: 'file-2', filename: '02.flac', rawPayload: { filename: 'Artist\\Album\\02.flac' } });
  const harness = createExecutionWorkerHarness(t, { candidates: [candidate], enqueue: async ({ files, username }) => ({
    enqueued: [{ ...files[0], username, id: randomUUID() }], failed: [files[1].filename],
  }) });
  await harness.run();
  assert.equal(assertCompleted(harness).awaitingConfirmationCount, 1);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
  assert.equal(harness.candidateRows.get(candidate.id).status, 'selected');
  assert.equal(harness.items.get(candidate.id).planningSnapshot.execution.handoff.attempt.receipts.length, 1);
  assert.equal(harness.items.get(candidate.id).planningSnapshot.execution.handoff.attempt.receiptDisposition, 'partial');
  assert.equal(harness.transitionDownloading.mock.callCount(), 0);
});

test('a lost response preserves its attempt for review and never marks downloading', async (t) => {
  const harness = createExecutionWorkerHarness(t, { enqueue: async () => { throw new Error('Connection lost after POST'); } });
  await harness.run();
  assert.ok(harness.marks.failed);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
  assert.equal(harness.transitionDownloading.mock.callCount(), 0);
  const execution = harness.items.get('candidate-1').planningSnapshot.execution;
  assert.equal(execution.handoff.state, 'dispatching');
  assert.ok(execution.handoff.attempt.attemptId);
  assert.deepEqual(execution.handoff.attempt.receipts, []);
});

test('a replaced lease refuses the prepared POST and records known non-dispatch', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    getLease: async () => ({ ownerInstanceId: 'another-worker', acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(), state: 'active', status: 'active' }),
  } });
  await harness.run();
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.transitionDownloading.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
});

test('source drift after checkpoint preparation refuses before the provider call', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    prepareDownloadHandoff: async (args) => {
      const prepared = await harness.handoff.prepareDownloadHandoff(args);
      harness.candidateRows.get(args.importCandidateId).sourceResponseKey = 'changed-response';
      return prepared;
    },
  } });
  await harness.run();
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.transitionDownloading.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
});

test('new planning blockers cannot erase an older unknown request or its original manifest', async (t) => {
  const candidate = executionCandidate();
  const saved = checkpoint(candidate);
  const blocked = { ...candidate, files: [], executionStatus: { code: 'blocked', message: 'Folder mapping changed.' } };
  const harness = createExecutionWorkerHarness(t, { candidates: [blocked], existingItems: [saved] });
  await harness.run();
  assert.equal(assertCompleted(harness).awaitingConfirmationCount, 1);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get(candidate.id).itemStatus, 'awaiting_confirmation');
  assert.deepEqual(harness.items.get(candidate.id).planningSnapshot.execution.requestedFiles,
    saved.planningSnapshot.execution.requestedFiles);
});

test('an absent lease identity cannot authorize a prepared POST', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    acquireLease: async () => ({}), getLease: async () => ({}),
  } });
  await harness.run();
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
});

test('a malformed current lease expiry cannot authorize a prepared POST', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    getLease: async () => ({ ...harness.lease, expiresAt: 'invalid' }),
  } });
  await harness.run();
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
});

test('a resumed known non-dispatch remains stopped without claiming uncertain acceptance', async (t) => {
  const candidate = executionCandidate();
  const saved = checkpoint(candidate);
  saved.itemStatus = 'blocked';
  saved.planningSnapshot.execution.handoff.state = 'not_dispatched';
  const harness = createExecutionWorkerHarness(t, { candidates: [candidate], existingItems: [saved] });
  await harness.run();
  const summary = assertCompleted(harness);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.awaitingConfirmationCount, 0);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get(candidate.id).itemStatus, 'blocked');
});

test('a known stopped checkpoint does not advertise public confirmation pending', async () => {
  const worklist = createImportCandidateExecutionConfirmationWorklistService({ buildRunWithItems: async (run) => run });
  const result = await worklist.buildExecutionConfirmationWorklist({ currentRun: {
    id: 'stopped-run', items: [{ itemStatus: 'awaiting_confirmation',
      planningSnapshot: { execution: { handoff: { state: 'not_dispatched' } } } }],
  } });
  assert.equal(result.confirmationPending, false);
  assert.equal(result.pendingConfirmationCount, 0);
});

for (const kind of ['expired', 'replaced']) {
  test(`a lease ${kind} during the awaited final checkpoint guard cannot authorize POST`, async (t) => {
    let observedLease;
    const harness = createExecutionWorkerHarness(t, { workerOverrides: {
      getLease: async () => observedLease ?? harness.lease,
      assertDownloadHandoffCurrent: async (args) => {
        await harness.handoff.assertDownloadHandoffCurrent(args);
        observedLease = { ...harness.lease, ...(kind === 'expired'
          ? { expiresAt: new Date(Date.now() - 1000).toISOString(), state: 'expired' }
          : { ownerInstanceId: 'replacement-worker' }) };
      },
    } });
    await harness.run();
    assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
    assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
  });
}
