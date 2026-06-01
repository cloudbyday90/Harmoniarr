import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';

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
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
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
  assert.equal(result.summary.snapshotsUpdated, 3);
  assert.equal(result.summary.transitioned, 3);
});

test('reconcileImportCandidateExecutionState only fails missing transfers after the grace window expires', async (t) => {
  const markImportCandidateDownloadFailed = t.mock.fn(async ({ importCandidateId }) => ({
    candidate: { id: importCandidateId, status: 'failed' },
  }));
  const updateImportExecutionRunItem = t.mock.fn(async () => null);
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
    updateImportExecutionRunItem: async () => null,
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
  assert.equal(result.summary.retried, 1);
  assert.equal(result.summary.transitioned, 1);
  assert.equal(result.retries[0].retrySameCandidate, true);
});
