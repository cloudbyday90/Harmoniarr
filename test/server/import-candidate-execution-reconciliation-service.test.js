import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createExecutionWorkerHarness, executionCandidate } from '../../testing/server/import-execution-worker-harness.js';

test('reconcileImportCandidateExecutionState persists workflow transitions from live transfer state', async (t) => {
  const markImportCandidateDownloading = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'downloading' },
  }));
  const markImportCandidateImportPending = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'import_pending' },
  }));
  const markImportCandidateDownloadFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'failed' },
  }));
  const updateImportExecutionRunItem = t.mock.fn(async (item) => item);
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        id: 'run-1',
        items: [{
          itemStatus: 'queued',
          liveTransfers: [{
            bytesTransferred: 10,
            filename: 'Queued.flac',
            id: 'transfer-1',
            placeInQueue: 2,
            size: 100,
            state: 'Queued, Remotely',
            username: 'user-1',
          }],
          liveTransferSummary: { status: 'queued', message: '1 transfer is still queued or waiting remotely.' },
          planningSnapshot: {
            candidate: { id: 'candidate-1' },
            execution: {
              enqueuedTransfers: [{ id: 'transfer-1', username: 'user-1' }],
              missingTransfer: {
                lastCheckedAt: '2026-05-01T00:00:00.000Z',
                missingSince: '2026-04-30T23:55:00.000Z',
              },
            },
          },
          statusMessage: 'Queued remotely',
        }, {
          itemStatus: 'queued',
          liveTransfers: [{
            bytesTransferred: 100,
            filename: 'Done.flac',
            id: 'transfer-2',
            size: 100,
            state: 'Completed, Succeeded',
            username: 'user-2',
          }],
          liveTransferSummary: { status: 'completed', message: '1 transfer completed successfully.' },
          planningSnapshot: { candidate: { id: 'candidate-2' }, execution: { enqueuedTransfers: [{ id: 'transfer-2', username: 'user-2' }] } },
          statusMessage: 'Completed',
        }, {
          itemStatus: 'queued_with_warnings',
          liveTransfers: [{
            bytesTransferred: 25,
            exception: 'Remote rejected transfer',
            filename: 'Failed.flac',
            id: 'transfer-3',
            size: 100,
            state: 'Completed, Errored',
            username: 'user-3',
          }],
          liveTransferSummary: { status: 'failed', message: '1 transfer reported a terminal slskd error.' },
          planningSnapshot: { candidate: { id: 'candidate-3' }, execution: { enqueuedTransfers: [{ id: 'transfer-3', username: 'user-3' }] } },
          statusMessage: 'Failed',
        }],
      },
    }),
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      status: importCandidateId === 'candidate-1'
        ? 'selected'
        : importCandidateId === 'candidate-2'
          ? 'downloading'
          : 'selected',
    }),
    markImportCandidateDownloadFailed,
    markImportCandidateDownloading,
    markImportCandidateImportPending,
    updateImportExecutionRunItem,
  });

  const result = await service.reconcileImportCandidateExecutionState({ actorUserId: 'user-1' });

  assert.equal(markImportCandidateDownloading.mock.callCount(), 1);
  assert.equal(markImportCandidateImportPending.mock.callCount(), 1);
  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 3);
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].operationRunId, 'run-1');
  assert.deepEqual(
    updateImportExecutionRunItem.mock.calls.map((call) => call.arguments[0].itemStatus),
    ['queued', 'completed', 'failed'],
    'reconciliation must replace stale queue-planning statuses with live provider outcomes',
  );
  assert.match(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.latestTransferSnapshot.lastSeenAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.latestTransferSnapshot.lastSeenAt,
    updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.latestTransferSnapshot.lastReconciledAt,
  );
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.missingTransfer, null);
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.latestTransferSnapshot.summary.status, 'queued');
  assert.equal(updateImportExecutionRunItem.mock.calls[1].arguments[0].planningSnapshot.execution.latestTransferSnapshot.summary.status, 'completed');
  assert.equal(updateImportExecutionRunItem.mock.calls[2].arguments[0].planningSnapshot.execution.latestTransferSnapshot.summary.status, 'failed');
  assert.equal(result.currentRunId, 'run-1');
  assert.equal(result.summary.rediscovered, 0);
  assert.equal(result.summary.snapshotsUpdated, 3);
  assert.equal(result.summary.transitioned, 3);
});

test('reconcileImportCandidateExecutionState starts safe auto apply after completed download', async (t) => {
  const startSafeApplyRunAfterDownloadCompleted = t.mock.fn(async ({ importCandidateId }) => ({
    attempted: true,
    importCandidateId,
    runId: 'apply-run-1',
    started: true,
    triggerSource: 'download_completed',
  }));
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        id: 'run-completed-auto-apply',
        items: [{
          itemStatus: 'queued',
          liveTransferSummary: { status: 'completed', message: '1 transfer completed successfully.' },
          planningSnapshot: { candidate: { id: 'candidate-complete-1' }, execution: {} },
          statusMessage: 'Completed',
        }],
      },
    }),
    getImportCandidate: async () => ({
      id: 'candidate-complete-1',
      status: 'downloading',
    }),
    markImportCandidateImportPending: async ({ importCandidateId }) => ({
      candidate: {
        id: importCandidateId,
        folderPath: 'Artist/Album',
        status: 'import_pending',
        username: 'source-user',
      },
    }),
    startSafeApplyRunAfterDownloadCompleted,
    updateImportExecutionRunItem: async (item) => item,
  });

  const result = await service.reconcileImportCandidateExecutionState({
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });

  assert.equal(startSafeApplyRunAfterDownloadCompleted.mock.callCount(), 1);
  assert.deepEqual(startSafeApplyRunAfterDownloadCompleted.mock.calls[0].arguments, [{
    importCandidateId: 'candidate-complete-1',
    operationRunId: 'run-completed-auto-apply',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  }]);
  assert.equal(result.summary.autoApplyStarted, 1);
  assert.equal(result.summary.autoApplySkipped, 0);
  assert.deepEqual(result.autoApplyRuns, [{
    attempted: true,
    importCandidateId: 'candidate-complete-1',
    runId: 'apply-run-1',
    started: true,
    triggerSource: 'download_completed',
  }]);
});

test('reconcileImportCandidateExecutionState only fails missing transfers after the grace window expires', async (t) => {
  const markImportCandidateDownloadFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'failed' },
  }));
  const updateImportExecutionRunItem = t.mock.fn(async (item) => item);
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        id: 'run-2',
        items: [{
          itemStatus: 'queued',
          liveTransferSummary: {
            message: 'No live slskd transfers were found for this execution item yet; Harmoniarr will keep reconciling for up to 5 minutes before treating it as orphaned.',
            missingTransfer: {
              graceDeadlineAt: '2026-05-01T00:05:00.000Z',
              missingSince: '2026-05-01T00:00:00.000Z',
              isPastGracePeriod: false,
              source: 'default',
            },
            status: 'not_found',
          },
          planningSnapshot: { candidate: { id: 'candidate-1' }, execution: {} },
          statusMessage: 'Missing transfer within grace window',
        }, {
          itemStatus: 'queued',
          liveTransferSummary: {
            message: 'No live slskd transfers were found for this execution item after the 5 minutes grace window; Harmoniarr will treat it as orphaned.',
            missingTransfer: {
              graceDeadlineAt: '2026-05-01T00:10:00.000Z',
              isPastGracePeriod: true,
              missingSince: '2026-05-01T00:05:00.000Z',
              source: 'default',
            },
            status: 'not_found',
          },
          planningSnapshot: { candidate: { id: 'candidate-2' }, execution: {} },
          statusMessage: 'Missing transfer after grace window',
        }],
      },
    }),
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      status: 'downloading',
    }),
    markImportCandidateDownloadFailed,
    updateImportExecutionRunItem,
  });

  const result = await service.reconcileImportCandidateExecutionState({ actorUserId: 'user-2' });

  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 2);
  assert.equal(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.missingTransfer.missingSince, '2026-05-01T00:00:00.000Z');
  assert.match(updateImportExecutionRunItem.mock.calls[0].arguments[0].planningSnapshot.execution.missingTransfer.lastCheckedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(updateImportExecutionRunItem.mock.calls[1].arguments[0].planningSnapshot.execution.missingTransfer.isPastGracePeriod, true);
  assert.deepEqual(markImportCandidateDownloadFailed.mock.calls[0].arguments[0], {
    actorUserId: 'user-2',
    importCandidateId: 'candidate-2',
    reason: 'No live slskd transfers were found for this execution item after the 5 minutes grace window; Harmoniarr will treat it as orphaned.',
    requestMetadata: null,
  });
  assert.equal(result.summary.rediscovered, 0);
  assert.equal(result.summary.snapshotsUpdated, 2);
  assert.equal(result.summary.transitioned, 1);
});

test('reconcileImportCandidateExecutionState schedules rejected-transfer retries before cascading', async (t) => {
  const handleImportCandidateRejectedTransfer = t.mock.fn(async ({ failedCandidateId }) => ({
    failedCandidateId,
    nextCandidateId: failedCandidateId,
    reason: 'candidate_retry_scheduled',
    recovered: true,
    retryAt: '2026-05-01T00:10:00.000Z',
    retrySameCandidate: true,
  }));
  const markImportCandidateDownloadFailed = t.mock.fn(async () => ({
    candidate: { id: 'unexpected', status: 'failed' },
  }));
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        id: 'run-rejected',
        status: 'completed',
        items: [{
          itemStatus: 'queued',
          liveTransfers: [{
            exception: null,
            filename: 'Rejected.flac',
            id: 'transfer-rejected',
            size: 100,
            state: 'Completed, Rejected',
            username: 'source-user',
          }],
          liveTransferSummary: {
            message: '1 transfer was rejected by the remote peer; Harmoniarr will retry this candidate before cascading.',
            rejected: 1,
            status: 'rejected',
          },
          planningSnapshot: { candidate: { id: 'candidate-rejected' }, execution: { enqueuedTransfers: [{ id: 'transfer-rejected', username: 'source-user' }] } },
          statusMessage: 'Rejected',
        }],
      },
    }),
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      status: 'downloading',
    }),
    handleImportCandidateRejectedTransfer,
    markImportCandidateDownloadFailed,
    updateImportExecutionRunItem: async (item) => item,
  });

  const result = await service.reconcileImportCandidateExecutionState();

  assert.equal(handleImportCandidateRejectedTransfer.mock.callCount(), 1);
  assert.deepEqual(handleImportCandidateRejectedTransfer.mock.calls[0].arguments[0], {
    failedCandidateId: 'candidate-rejected',
    failureReason: '1 transfer was rejected by the remote peer; Harmoniarr will retry this candidate before cascading.',
    operationRunId: 'run-rejected',
    scheduleFollowUpRun: true,
  });
  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 0);
  assert.equal(result.summary.rediscovered, 0);
  assert.equal(result.summary.retried, 1);
  assert.equal(result.summary.transitioned, 1);
  assert.equal(result.retries[0].retrySameCandidate, true);
});

test('reconcileImportCandidateExecutionState reports rediscovery scheduled after failed cascade exhaustion', async (t) => {
  const markImportCandidateDownloadFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'failed' },
  }));
  const handleImportCandidateDownloadFailure = t.mock.fn(async () => ({
    failedCandidateId: 'candidate-failed',
    reason: 'rediscovery_scheduled',
    recovered: false,
    rediscovery: {
      discoveryRunId: 'discovery-run-1',
      metadataReleaseId: 'release-1',
      nextSearchAfter: '2026-05-01T02:00:00.000Z',
      scheduled: true,
    },
  }));
  const recordActivityEventFn = t.mock.fn(async () => {});
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        id: 'run-failed',
        status: 'completed',
        items: [{
          itemStatus: 'queued_with_warnings',
          liveTransferSummary: {
            message: '1 transfer reported a terminal slskd error.',
            status: 'failed',
          },
          planningSnapshot: { candidate: { id: 'candidate-failed' }, execution: {} },
          statusMessage: 'Failed',
        }],
      },
    }),
    getImportCandidate: async ({ importCandidateId }) => ({
      id: importCandidateId,
      normalizedPayload: {
        requestOwnership: {
          wantedReleaseId: 'wanted-1',
        },
      },
      status: 'downloading',
    }),
    handleImportCandidateDownloadFailure,
    markImportCandidateDownloadFailed,
    recordActivityEventFn,
    updateImportExecutionRunItem: async (item) => item,
  });

  const result = await service.reconcileImportCandidateExecutionState();

  assert.equal(markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(handleImportCandidateDownloadFailure.mock.callCount(), 1);
  assert.equal(result.summary.rediscovered, 1);
  assert.equal(result.summary.recovered, 0);
  assert.equal(recordActivityEventFn.mock.callCount(), 1);
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].eventType, 'music_queue_no_matches_left');
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].entityId, 'wanted-1');
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].extraPayload.rediscoveryScheduled, true);
  assert.deepEqual(result.rediscoveries, [{
    discoveryRunId: 'discovery-run-1',
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    scheduled: true,
  }]);
});

function checkpointFixture(t, { disposition = 'confirmed', legacy = false } = {}) {
  const candidate = executionCandidate({ id: 'candidate-handoff-confirmed' });
  if (disposition === 'partial') {
    candidate.files.push({ ...candidate.files[0], id: 'file-2', filename: '02.flac',
      rawPayload: { filename: 'Artist\\Album\\02.flac' } });
    candidate.fileCount = 2; candidate.totalSizeBytes = 246;
  }
  const operationRunId = 'run-handoff-confirmation';
  const requestedFiles = candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  const sourceObservation = captureRecoveryObservation(candidate);
  const original = createDownloadAttempt({ importCandidateId: candidate.id, operationRunId,
    requestedFiles, sourceObservation, username: candidate.username });
  const transfers = requestedFiles.map((file) => ({ ...file, id: randomUUID(), username: candidate.username, direction: 'Download' }));
  const proof = evaluateDownloadReceipt({ attempt: original, enqueueResult: {
    enqueued: disposition === 'confirmed' ? transfers : disposition === 'partial' ? [transfers[0]] : [],
    failed: disposition === 'partial' ? [requestedFiles[1].filename]
      : disposition === 'rejected' ? requestedFiles.map((file) => file.filename) : [],
  } });
  const item = { id: randomUUID(), importCandidateId: candidate.id, operationRunId,
    itemStatus: 'awaiting_confirmation', statusMessage: 'Confirming earlier request.',
    // Even a full-looking legacy matcher result cannot replace the stored owner proof.
    handoffConfirmation: { allRequestedFilesMatched: true, disposition: 'confirmed',
      matchedTransfers: transfers, requestedFileCount: requestedFiles.length },
    liveTransferSummary: { status: 'queued' },
    planningSnapshot: { candidate: { id: candidate.id, status: 'selected' }, execution: {
      sourceObservation, requestedFiles, handoff: { state: 'awaiting_confirmation', ...(legacy ? {} : { attempt: proof.attempt }) },
    } },
  };
  const harness = createExecutionWorkerHarness(t, { candidates: [candidate], existingItems: [item] });
  const confirmDownloadHandoff = t.mock.fn(harness.handoff.confirmDownloadHandoff);
  const markImportCandidateDownloadFailed = t.mock.fn(async ({ importCandidateId }) => {
    const changed = { ...harness.candidateRows.get(importCandidateId), status: 'failed' };
    harness.candidateRows.set(importCandidateId, changed);
    return { candidate: changed };
  });
  const handleImportCandidateDownloadFailure = t.mock.fn(async () => ({ recovered: false }));
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({ currentRun: { id: operationRunId, items: [item] } }),
    confirmDownloadHandoff,
    getImportCandidate: async ({ importCandidateId }) => structuredClone(harness.candidateRows.get(importCandidateId)),
    markImportCandidateDownloading: async () => assert.fail('Only the receipt owner may advance the handoff phase'),
    updateImportExecutionRunItem: async () => assert.fail('Only the receipt owner may certify its checkpoint'),
    markImportCandidateDownloadFailed, handleImportCandidateDownloadFailure,
  });
  return { candidate, item, operationRunId, proof, harness, confirmDownloadHandoff,
    markImportCandidateDownloadFailed, handleImportCandidateDownloadFailure, service };
}

test('reconciliation confirms durable exact receipts through the real owner once without another provider request', async (t) => {
  const fixture = checkpointFixture(t);
  const requestMetadata = { ipAddress: '127.0.0.1', userAgent: 'unit-reconciliation' };
  const result = await fixture.service.reconcileImportCandidateExecutionState({ actorUserId: 'user-1', requestMetadata });
  assert.deepEqual(fixture.confirmDownloadHandoff.mock.calls[0].arguments[0], {
    importCandidateId: fixture.candidate.id, operationRunId: fixture.operationRunId,
    attemptId: fixture.proof.attempt.attemptId, expectedAttempt: fixture.proof.attempt, actorUserId: 'user-1', requestMetadata,
  });
  assert.equal(fixture.harness.candidateRows.get(fixture.candidate.id).status, 'downloading');
  assert.equal(fixture.harness.items.get(fixture.candidate.id).itemStatus, 'queued');
  assert.equal(fixture.harness.items.get(fixture.candidate.id).planningSnapshot.execution.handoff.state, 'confirmed');
  assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 1);
  assert.equal(fixture.harness.recordConfirmedTransfers.mock.callCount(), 1);
  assert.equal(fixture.harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(result.summary.snapshotsUpdated, 1); assert.equal(result.summary.transitioned, 1);
  const replay = await fixture.service.reconcileImportCandidateExecutionState();
  assert.equal(replay.summary.snapshotsUpdated, 0); assert.equal(replay.summary.transitioned, 0);
  assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 1);
  assert.equal(fixture.harness.recordConfirmedTransfers.mock.callCount(), 1);
});

test('unknown, partial and uncorrelated legacy checkpoints cannot be confirmed by a full-looking matcher boolean', async (t) => {
  for (const options of [{ disposition: 'unknown' }, { disposition: 'partial' }, { legacy: true }]) {
    const fixture = checkpointFixture(t, options);
    const result = await fixture.service.reconcileImportCandidateExecutionState();
    assert.equal(fixture.harness.candidateRows.get(fixture.candidate.id).status, 'selected');
    assert.equal(fixture.harness.items.get(fixture.candidate.id).planningSnapshot.execution.handoff.state, 'awaiting_confirmation');
    assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 0);
    assert.equal(fixture.harness.enqueueDownloads.mock.callCount(), 0);
    assert.equal(fixture.markImportCandidateDownloadFailed.mock.callCount(), 0);
    assert.equal(fixture.handleImportCandidateDownloadFailure.mock.callCount(), 0);
    assert.equal(result.summary.transitioned, 0); assert.equal(result.summary.recovered, 0);
  }
});

test('a causal full receipt cannot advance a candidate whose source changed after the checkpoint', async (t) => {
  const fixture = checkpointFixture(t);
  fixture.harness.candidateRows.get(fixture.candidate.id).sourceResponseKey = 'new-current-source';
  const result = await fixture.service.reconcileImportCandidateExecutionState();
  const ownerResult = await fixture.confirmDownloadHandoff.mock.calls[0].result;
  assert.equal(ownerResult.disposition, 'confirmed'); assert.equal(ownerResult.confirmed, false);
  assert.equal(ownerResult.phaseAdvanced, false);
  assert.equal(fixture.harness.candidateRows.get(fixture.candidate.id).status, 'selected');
  assert.equal(fixture.harness.candidateRows.get(fixture.candidate.id).sourceResponseKey, 'new-current-source');
  assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 0);
  assert.equal(fixture.harness.recordConfirmedTransfers.mock.callCount(), 0);
  assert.equal(fixture.handleImportCandidateDownloadFailure.mock.callCount(), 0);
  assert.equal(result.summary.transitioned, 0);
});

test('an already-confirmed generic attempt refuses stale source or newer-origin completion before phase, failure or auto-add', async (t) => {
  for (const drift of ['source', 'origin']) {
    const fixture = checkpointFixture(t);
    const candidate = fixture.harness.candidateRows.get(fixture.candidate.id);
    candidate.status = 'downloading';
    const acceptedCandidateObservation = captureRecoveryObservation(candidate);
    if (drift === 'source') candidate.sourceResponseKey = 'new-current-source';
    const item = structuredClone(fixture.item);
    item.itemStatus = 'queued';
    item.planningSnapshot.execution.handoff.state = 'confirmed';
    item.planningSnapshot.execution.acceptedCandidateObservation = acceptedCandidateObservation;
    item.planningSnapshot.execution.enqueuedTransfers = fixture.proof.matchedTransfers;
    item.liveTransferSummary = { status: 'completed', message: 'The old provider receipt reports completion.' };
    item.liveTransfers = fixture.proof.matchedTransfers.map((transfer) => ({ ...transfer, state: 'Completed, Succeeded', bytesTransferred: transfer.size }));
    const service = createImportCandidateExecutionReconciliationService({
      getImportCandidate: async () => structuredClone(candidate),
      isCurrentExecutionObservation: async () => drift !== 'origin',
      ownsRecoveryCandidate: async () => false,
      updateImportExecutionRunItem: async (input) => input,
      confirmDownloadHandoff: async () => assert.fail('This attempt is already confirmed'),
      markImportCandidateImportPending: async () => assert.fail('An old receipt cannot advance the current generic source'),
      markImportCandidateDownloadFailed: async () => assert.fail('Stale receipt observation cannot fail the current source'),
      transitionOwnedExecutionCandidate: async () => assert.fail('A stale observation cannot reach the phase owner'),
      handleImportCandidateDownloadFailure: async () => assert.fail('Stale receipt observation cannot acquire another match'),
      handleImportCandidateRejectedTransfer: async () => assert.fail('Stale receipt observation cannot retry'),
      startSafeApplyRunAfterDownloadCompleted: async () => assert.fail('Stale receipt observation cannot auto-add'),
    });
    const result = await service.reconcileImportCandidateExecutionState({ executionSummary: {
      currentRun: { id: fixture.operationRunId, items: [item] },
    } });
    assert.equal(candidate.status, 'downloading', drift);
    assert.equal(result.summary.transitioned, 0, drift);
    assert.equal(result.summary.recovered, 0, drift);
    assert.equal(result.summary.autoApplyStarted, 0, drift);
  }
});

test('an exact persisted rejection reaches failure recovery without treating partial evidence as rejection', async (t) => {
  const fixture = checkpointFixture(t, { disposition: 'rejected' });
  await fixture.service.reconcileImportCandidateExecutionState();
  assert.equal(fixture.harness.items.get(fixture.candidate.id).itemStatus, 'queue_failed');
  assert.equal(fixture.markImportCandidateDownloadFailed.mock.callCount(), 1);
  assert.equal(fixture.handleImportCandidateDownloadFailure.mock.callCount(), 1);
  assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 0);
  assert.equal(fixture.harness.enqueueDownloads.mock.callCount(), 0);
});

test('older unresolved runs are reconciled once even when the latest run has no matching item', async (t) => {
  const fixture = checkpointFixture(t);
  const older = { id: fixture.operationRunId, items: [fixture.item] };
  const result = await fixture.service.reconcileImportCandidateExecutionState({ executionSummary: {
    currentRun: { id: 'new-current-run', items: [] }, unconfirmedRuns: [older, older],
  } });
  assert.equal(result.currentRunId, 'new-current-run');
  assert.equal(fixture.confirmDownloadHandoff.mock.callCount(), 1);
  assert.equal(fixture.harness.transitionDownloading.mock.callCount(), 1);
  assert.equal(result.summary.transitioned, 1);
});

test('a refused normal snapshot CAS cannot advance phase or trigger recovery', async (t) => {
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
  const service = createImportCandidateExecutionReconciliationService({ updateImportExecutionRunItem,
    getImportCandidate: async () => assert.fail('A refused snapshot cannot proceed to a phase decision'),
    markImportCandidateDownloading: async () => assert.fail('A refused snapshot cannot advance phase'),
    handleImportCandidateDownloadFailure: async () => assert.fail('A refused snapshot cannot trigger recovery'),
  });
  const result = await service.reconcileImportCandidateExecutionState({ executionSummary: { currentRun: {
    id: 'current-run', items: [{ importCandidateId: 'candidate', itemStatus: 'queued',
      planningSnapshot: { candidate: { id: 'candidate' }, execution: {} }, liveTransferSummary: { status: 'queued' } }],
  } } });
  assert.equal(updateImportExecutionRunItem.mock.callCount(), 1);
  assert.equal(result.summary.snapshotsUpdated, 0); assert.equal(result.summary.transitioned, 0);
});
