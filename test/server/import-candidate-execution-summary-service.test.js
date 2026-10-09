import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';

const transferId = '10000000-0000-4000-8000-000000000001';
const secondTransferId = '10000000-0000-4000-8000-000000000002';
function savedAttempt({ importCandidateId, operationRunId, username, files, receipts }) {
  const attempt = createDownloadAttempt({ importCandidateId, operationRunId, username, requestedFiles: files, sourceObservation: { candidateId: importCandidateId, username } });
  return evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued: receipts, failed: [] } }).attempt;
}

test('buildImportCandidateExecutionSummary returns the current run with persisted items', async () => {
  const importCandidateExecutionHeartbeatState = {
    getHeartbeatState: () => ({
      lastOutcome: 'started',
      lastTickAt: '2026-04-30T20:01:00.000Z',
    }),
  };
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: () => null,
    }),
    importCandidateExecutionHeartbeatConfig: {
      intervalLabel: '1 minute',
      intervalMs: 60000,
      mode: 'automatic',
      source: 'default',
    },
    importCandidateExecutionHeartbeatState,
    importCandidateExecutionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        blockedCount: 1,
        currentStep: 'Planning snapshot complete',
        executionMode: 'planning_only',
        finishedAt: '2026-04-30T20:00:00.000Z',
        id: 'run-1',
        processedCandidateCount: 1,
        readyCount: 0,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-04-30T19:59:00.000Z',
        status: 'completed',
        totalSelected: 1,
      }),
      listRecentRuns: async () => [{
        blockedCount: 1,
        currentStep: 'Planning snapshot complete',
        executionMode: 'planning_only',
        finishedAt: '2026-04-30T20:00:00.000Z',
        id: 'run-1',
        processedCandidateCount: 1,
        readyCount: 0,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-04-30T19:59:00.000Z',
        status: 'completed',
        totalSelected: 1,
      }],
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-1',
      itemStatus: 'blocked',
      planningSnapshot: {
        candidate: { id: 'candidate-1' },
      },
      statusMessage: 'Explicit path mapping is still required.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.heartbeat.intervalLabel, '1 minute');
  assert.equal(summary.heartbeat.state.lastOutcome, 'started');
  assert.equal(summary.currentRun.id, 'run-1');
  assert.equal(summary.currentRun.items.length, 1);
  assert.equal(summary.recentRuns.length, 1);
  assert.equal(summary.recentRuns[0].id, 'run-1');
  assert.equal(summary.summary.status, 'blocked');
  assert.equal(summary.summary.message, '1 planned import candidate is blocked and needs operator attention.');
});

test('buildImportCandidateExecutionSummary exposes exact transfer confirmation for a checkpointed handoff', async () => {
  const attempt = savedAttempt({ importCandidateId: 'candidate-handoff-summary', operationRunId: 'run-handoff-summary', username: 'source-user',
    files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }], receipts: [{ id: transferId, username: 'source-user', filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }] });
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async ({ requestedTransfers }) => { assert.equal(requestedTransfers[0].id, transferId);
      return { getTransfer: ({ id }) => ({ ...requestedTransfers.find((transfer) => transfer.id === id), state: 'Queued, Remotely' }) }; },
    findMatchingTransfers: async ({ requestedFiles, username }) => ({
      disposition: 'confirmed',
      allRequestedFilesMatched: true,
      matchedTransfers: [{
        filename: requestedFiles[0].filename,
        id: transferId,
        size: requestedFiles[0].size,
        state: 'Queued, Remotely',
        username,
      }],
      requestedFileCount: requestedFiles.length,
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-handoff-summary',
        status: 'completed',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-handoff-summary',
      itemStatus: 'awaiting_confirmation',
      planningSnapshot: {
        candidate: { id: 'candidate-handoff-summary', username: 'source-user' },
        execution: {
          handoff: { state: 'awaiting_confirmation', attempt },
          requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }],
        },
      },
      statusMessage: 'Confirming earlier request.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();
  const item = summary.currentRun.items[0];

  assert.equal(item.handoffConfirmation.allRequestedFilesMatched, true);
  assert.equal(item.handoffConfirmation.matchedTransfers[0].id, transferId);
  assert.equal(item.liveTransferSummary.status, 'queued');
});

test('buildImportCandidateExecutionSummary keeps an unconfirmed handoff visible when slskd is unavailable', async () => {
  const unavailable = Object.assign(new Error('slskd unavailable'), { code: 'slskd_unavailable' });
  const service = createImportCandidateExecutionSummaryService({
    findMatchingTransfers: async () => {
      throw unavailable;
    },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-handoff-unavailable',
        status: 'completed',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-handoff-unavailable',
      itemStatus: 'awaiting_confirmation',
      planningSnapshot: {
        candidate: { id: 'candidate-handoff-unavailable', username: 'source-user' },
        execution: {
          handoff: { state: 'awaiting_confirmation' },
          requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }],
        },
      },
      statusMessage: 'Confirming earlier request.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.transferSnapshotUnavailable, true);
  assert.equal(summary.currentRun.items[0].handoffConfirmation.providerUnavailable, true);
});

test('unknown or partial current receipts never display a completed subset and pass exact immutable attempt context', async () => {
  for (const disposition of ['unknown', 'partial']) {
    const attempt = savedAttempt({ importCandidateId: 'candidate-original', operationRunId: 'run-original', username: 'original-peer',
      files: [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }], receipts: [{ id: transferId, username: 'original-peer', filename: 'One.mp3', size: 1000 }] });
    const service = createImportCandidateExecutionSummaryService({
      buildTransferSnapshot: async () => ({ getTransfer: () => ({ id: transferId, username: 'original-peer', state: 'Completed, Succeeded', size: 1000, bytesTransferred: 1000 }) }),
      findMatchingTransfers: async (args) => {
        assert.equal(args.attempt, attempt);
        assert.equal(args.importCandidateId, 'candidate-original');
        assert.equal(args.operationRunId, 'run-original');
        assert.equal(args.username, 'original-peer');
        assert.deepEqual(args.requestedFiles, [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }]);
        return { disposition, allRequestedFilesMatched: false, requestedFileCount: 2, matchedTransfers: attempt.receipts };
      },
      importCandidateExecutionRunStore: { getActiveRun: async () => null, getLatestRun: async () => ({ id: 'run-original', executionMode: 'download_enqueue', status: 'completed' }) },
      listImportExecutionRunItemsFn: async () => [{ itemStatus: 'awaiting_confirmation', planningSnapshot: {
        candidate: { id: 'candidate-original', username: 'mutable-peer' }, execution: { handoff: { state: 'awaiting_confirmation', attempt },
          requestedFiles: [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }] } } }],
    });
    const summary = await service.buildImportCandidateExecutionSummary();
    assert.equal(summary.currentRun.items[0].liveTransferSummary, null);
    assert.deepEqual(summary.currentRun.items[0].liveTransfers, []);
    assert.equal(summary.confirmationPending, true);
    assert.equal(summary.summary.status, 'attention');
    assert.equal(summary.pendingConfirmationCount, 1);
  }
});

test('complete receipts remain accepted while unavailable or incomplete live observations cannot imply whole-request completion', async () => {
  for (const unavailable of [false, true]) {
    const receipts = [{ id: transferId, username: 'peer', filename: 'One.mp3', size: 1000 }, { id: secondTransferId, username: 'peer', filename: 'Two.mp3', size: 1000 }];
    const attempt = savedAttempt({ importCandidateId: 'candidate', operationRunId: 'run', username: 'peer',
      files: [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }], receipts });
    const service = createImportCandidateExecutionSummaryService({
      buildTransferSnapshot: async () => {
        if (unavailable) throw Object.assign(new Error('Unavailable'), { code: 'slskd_unavailable' });
        return { getTransfer: ({ id }) => id === transferId ? { ...receipts[0], state: 'Completed, Succeeded', bytesTransferred: 1000 } : null };
      },
      findMatchingTransfers: async () => ({ disposition: 'confirmed', allRequestedFilesMatched: true, requestedFileCount: 2, matchedTransfers: receipts }),
      importCandidateExecutionRunStore: { getActiveRun: async () => null, getLatestRun: async () => ({ id: 'run', executionMode: 'download_enqueue', status: 'completed' }) },
      listImportExecutionRunItemsFn: async () => [{ itemStatus: 'awaiting_confirmation', planningSnapshot: { candidate: { id: 'candidate', username: 'peer' },
        execution: { handoff: { state: 'awaiting_confirmation', attempt }, requestedFiles: [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }] } } }],
    });
    const summary = await service.buildImportCandidateExecutionSummary();
    assert.equal(summary.currentRun.items[0].handoffConfirmation.disposition, 'confirmed');
    assert.equal(summary.currentRun.items[0].liveTransferSummary, null);
    assert.equal(summary.currentRun.items[0].transferObservationPending, true);
  }
});

test('newer ordinary summary still hydrates older pending jobs privately with a bounded legacy control indication', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({ getTransfer: () => null }),
    importCandidateExecutionRunStore: { getActiveRun: async () => null, getLatestRun: async () => ({ id: 'newer', executionMode: 'download_enqueue', status: 'completed' }),
      listUnconfirmedExecutionRuns: async (args) => { assert.equal(args.excludeRunId, 'newer'); return { runIds: ['older'], pendingConfirmationCount: 1 }; },
      getRunById: async (id) => ({ id, executionMode: 'download_enqueue', status: 'failed' }) },
    listImportExecutionRunItemsFn: async (id) => id === 'older' ? [{ itemStatus: 'awaiting_confirmation', planningSnapshot: { candidate: { id: 'candidate' },
      execution: { handoff: { state: 'awaiting_confirmation' }, requestedFiles: [{ filename: 'One.mp3', size: 1000 }] } } }] : [],
  });
  const result = await service.buildImportCandidateExecutionSummary();
  assert.equal(result.currentRun.id, 'newer');
  assert.equal(result.unconfirmedRuns[0].id, 'older');
  assert.equal(result.summary.confirmationPending, true);
  assert.equal(result.summary.pendingConfirmationCount, 1);
});

test('legacy awaiting items without a handoff stay unknown while proven not dispatched items ignore stale awaiting counts', async () => {
  for (const notDispatched of [false, true]) {
    const service = createImportCandidateExecutionSummaryService({
      buildTransferSnapshot: async () => ({ getTransfer: () => null }),
      findMatchingTransfers: createSlskdDownloadHandoffReconciliationService().findMatchingTransfers,
      importCandidateExecutionRunStore: { getActiveRun: async () => null, getLatestRun: async () => ({ id: 'legacy', executionMode: 'download_enqueue', status: 'completed', awaitingConfirmationCount: 1 }) },
      listImportExecutionRunItemsFn: async () => [{ itemStatus: 'awaiting_confirmation', planningSnapshot: { candidate: { id: 'legacy-candidate', username: 'peer' },
        execution: { requestedFiles: [{ filename: 'One.mp3', size: 1000 }], ...(notDispatched ? { handoff: { state: 'not_dispatched' } } : {}) } } }],
    });
    const result = await service.buildImportCandidateExecutionSummary();
    assert.equal(result.confirmationPending, !notDispatched);
    assert.equal(result.currentRun.items[0].liveTransferSummary, null);
    if (!notDispatched) assert.equal(result.currentRun.items[0].handoffConfirmation.disposition, 'unknown');
    else assert.notEqual(result.summary.status, 'attention');
  }
});

test('new attempt live state rejects wrong peer, filename, size and direction through pending and confirmed checkpoints', async () => {
  for (const state of ['awaiting_confirmation', 'confirmed']) {
    for (const change of [{ username: 'wrong-peer' }, { filename: 'Wrong.mp3' }, { size: 999 }, { direction: 'Upload' }]) {
      const files = [{ filename: 'One.mp3', size: 1000 }];
      const receipts = [{ id: transferId, username: 'peer', ...files[0] }];
      const attempt = savedAttempt({ importCandidateId: 'candidate', operationRunId: 'run', username: 'peer', files, receipts });
      const service = createImportCandidateExecutionSummaryService({
        buildTransferSnapshot: async () => ({ getTransfer: () => ({ ...receipts[0], state: 'Completed, Succeeded', ...change }) }),
        findMatchingTransfers: createSlskdDownloadHandoffReconciliationService().findMatchingTransfers,
        importCandidateExecutionRunStore: { getActiveRun: async () => null, getLatestRun: async () => ({ id: 'run', executionMode: 'download_enqueue', status: 'completed' }) },
        listImportExecutionRunItemsFn: async () => [{ itemStatus: state === 'confirmed' ? 'queued' : 'awaiting_confirmation', planningSnapshot: {
          candidate: { id: 'candidate', username: 'peer' }, execution: { handoff: { state, attempt }, requestedFiles: files, enqueuedTransfers: receipts } } }],
      });
      const summary = await service.buildImportCandidateExecutionSummary();
      assert.equal(summary.currentRun.items[0].liveTransferSummary, null, JSON.stringify({ state, change }));
      assert.equal(summary.currentRun.items[0].transferObservationPending, true);
    }
  }
});

test('buildImportCandidateExecutionSummary reports no run when none exist', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: () => null,
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => null,
      listRecentRuns: async () => [],
    },
    listImportExecutionRunItemsFn: async () => [],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun, null);
  assert.deepEqual(summary.recentRuns, []);
  assert.equal(summary.summary.status, 'not_started');
});

test('buildImportCandidateExecutionSummary reconciles live slskd transfers for enqueued items', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: ({ id, username }) => ({
        averageSpeed: 128000,
        bytesTransferred: 500,
        exception: null,
        filename: 'Autechre\\Amber\\01 Foil.flac',
        id,
        placeInQueue: 2,
        size: 1000,
        state: 'Queued, Remotely',
        username,
      }),
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        blockedCount: 0,
        currentStep: 'Download enqueue complete',
        executionMode: 'download_enqueue',
        finishedAt: null,
        id: 'run-2',
        processedCandidateCount: 1,
        queueFailedCount: 0,
        queuedCount: 1,
        queuedWithWarningsCount: 0,
        readyCount: 1,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-04-30T19:59:00.000Z',
        status: 'running',
        totalSelected: 1,
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-2',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-2' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-1',
            username: 'source-user',
          }],
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.items[0].liveTransfers.length, 1);
  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'queued');
  assert.equal(summary.currentRun.items[0].liveTransferSummary.percentComplete, 50);
  assert.equal(summary.currentRun.items[0].persistedTransferObservation, null);
});

test('buildImportCandidateExecutionSummary classifies terminal transfer states without relying on exceptions', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: ({ id, username }) => ({
        bytesTransferred: 0,
        exception: null,
        filename: `${id}.flac`,
        id,
        size: 1000,
        state: id === 'transfer-rejected'
          ? 'Completed, Rejected'
          : 'Completed, TimedOut',
        username,
      }),
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-terminal-states',
        status: 'running',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-rejected',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-rejected' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-rejected',
            username: 'source-user',
          }],
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
    }, {
      id: 'item-timed-out',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-timed-out' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-timed-out',
            username: 'source-user',
          }],
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'rejected');
  assert.equal(summary.currentRun.items[0].liveTransferSummary.rejected, 1);
  assert.equal(summary.currentRun.items[1].liveTransferSummary.status, 'failed');
  assert.equal(summary.currentRun.items[1].liveTransferSummary.failed, 1);
});

test('buildImportCandidateExecutionSummary falls back to removed downloads and delays orphan handling inside the grace window', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: () => ({
        bytesTransferred: 1000,
        exception: null,
        filename: 'Autechre\\Amber\\01 Foil.flac',
        id: 'transfer-1',
        size: 1000,
        state: 'Completed, Succeeded',
        username: 'source-user',
      }),
    }),
    importCandidateExecutionMissingTransferConfig: {
      gracePeriodLabel: '5 minutes',
      gracePeriodMs: 300000,
      mode: 'grace_window',
      source: 'default',
    },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-removed',
        status: 'running',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-removed',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-removed' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-1',
            username: 'source-user',
          }],
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: '2026-04-30T19:59:00.000Z',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'completed');
  assert.equal(summary.currentRun.items[0].liveTransfers.length, 1);
});

test('buildImportCandidateExecutionSummary marks transfers as missing until the orphan grace window expires', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: ({ id }) => id === 'transfer-2'
        ? null
        : null,
    }),
    importCandidateExecutionMissingTransferConfig: {
      gracePeriodLabel: '5 minutes',
      gracePeriodMs: 300000,
      mode: 'grace_window',
      source: 'default',
    },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-missing',
        status: 'running',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-missing',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-missing' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-1',
            username: 'source-user',
          }],
          latestTransferSnapshot: {
            lastReconciledAt: new Date(Date.now() - 60000).toISOString(),
            lastSeenAt: new Date(Date.now() - 60000).toISOString(),
            summary: {
              message: '1 transfer is still queued or waiting remotely.',
              status: 'queued',
              total: 1,
            },
            transfers: [{
              id: 'transfer-1',
              username: 'source-user',
            }],
          },
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: new Date(Date.now() - 600000).toISOString(),
    }, {
      id: 'item-orphaned',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-orphaned' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-2',
            username: 'source-user',
          }],
          latestTransferSnapshot: {
            lastReconciledAt: new Date(Date.now() - 600000).toISOString(),
            lastSeenAt: new Date(Date.now() - 600000).toISOString(),
            summary: {
              message: '1 transfer is still queued or waiting remotely.',
              status: 'queued',
              total: 1,
            },
            transfers: [{
              id: 'transfer-2',
              username: 'source-user',
            }],
          },
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: new Date(Date.now() - 60000).toISOString(),
    }, {
      id: 'item-never-seen',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-never-seen' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-3',
            username: 'source-user',
          }],
          requestedAt: new Date(Date.now() - 600000).toISOString(),
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: new Date(Date.now() - 60000).toISOString(),
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'not_found');
  assert.equal(summary.currentRun.items[0].liveTransferSummary.missingTransfer.isPastGracePeriod, false);
  assert.equal(summary.currentRun.items[0].persistedTransferObservation.summary.status, 'queued');
  assert.equal(summary.currentRun.items[0].persistedMissingTransfer, null);
  assert.match(summary.currentRun.items[0].liveTransferSummary.message, /keep reconciling/);
  assert.equal(summary.currentRun.items[1].liveTransferSummary.status, 'not_found');
  assert.equal(summary.currentRun.items[1].liveTransferSummary.missingTransfer.isPastGracePeriod, true);
  assert.equal(summary.currentRun.items[1].persistedTransferObservation.summary.status, 'queued');
  assert.equal(summary.currentRun.items[1].persistedMissingTransfer, null);
  assert.match(summary.currentRun.items[1].liveTransferSummary.message, /treat it as orphaned/);
  assert.equal(summary.currentRun.items[2].liveTransferSummary.status, 'not_found');
  assert.equal(summary.currentRun.items[2].liveTransferSummary.missingTransfer.isPastGracePeriod, true);
  assert.equal(summary.currentRun.items[2].persistedTransferObservation, null);
  assert.equal(summary.currentRun.items[2].persistedMissingTransfer, null);
  assert.equal(summary.missingTransferPolicy.gracePeriodLabel, '5 minutes');
});

test('buildImportCandidateExecutionSummary exposes persisted missing-transfer state as a normalized read model', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: () => null,
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-persisted-missing',
        status: 'running',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-persisted-missing',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-persisted-missing' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-persisted-missing',
            username: 'source-user',
          }],
          latestTransferSnapshot: {
            lastReconciledAt: '2026-05-01T00:04:00.000Z',
            lastSeenAt: '2026-05-01T00:04:00.000Z',
            summary: {
              message: '1 transfer is still queued or waiting remotely.',
              status: 'queued',
              total: 1,
            },
            transfers: [{
              id: 'transfer-persisted-missing',
              username: 'source-user',
            }],
          },
          missingTransfer: {
            graceDeadlineAt: '2026-05-01T00:10:00.000Z',
            gracePeriodLabel: '5 minutes',
            gracePeriodMs: 300000,
            isPastGracePeriod: false,
            lastCheckedAt: '2026-05-01T00:06:00.000Z',
            message: 'No live slskd transfers were found for this execution item yet; Harmoniarr will keep reconciling for up to 5 minutes before treating it as orphaned.',
            missingSince: '2026-05-01T00:05:00.000Z',
            source: 'default',
          },
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: '2026-05-01T00:06:00.000Z',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.deepEqual(summary.currentRun.items[0].persistedMissingTransfer, {
    graceDeadlineAt: '2026-05-01T00:10:00.000Z',
    gracePeriodLabel: '5 minutes',
    gracePeriodMs: 300000,
    isPastGracePeriod: false,
    lastCheckedAt: '2026-05-01T00:06:00.000Z',
    message: 'No live slskd transfers were found for this execution item yet; Harmoniarr will keep reconciling for up to 5 minutes before treating it as orphaned.',
    missingSince: '2026-05-01T00:05:00.000Z',
    source: 'default',
  });
  assert.equal(summary.currentRun.items[0].persistedTransferObservation.summary.status, 'queued');
});

test('buildImportCandidateExecutionSummary returns partial data with transferSnapshotUnavailable when slskd is unavailable', async () => {
  const slskdError = new Error('slskd download list request failed before receiving a response');
  slskdError.code = 'slskd_unavailable';

  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => { throw slskdError; },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        blockedCount: 0,
        currentStep: 'Download enqueue complete',
        executionMode: 'download_enqueue',
        finishedAt: null,
        id: 'run-down',
        processedCandidateCount: 1,
        queueFailedCount: 0,
        queuedCount: 1,
        queuedWithWarningsCount: 0,
        readyCount: 1,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-05-01T00:00:00.000Z',
        status: 'running',
        totalSelected: 1,
      }),
      getLatestRun: async () => null,
      listRecentRuns: async () => [],
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-down',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-down' },
        execution: {
          enqueuedTransfers: [{
            id: 'transfer-down',
            username: 'source-user',
          }],
          latestTransferSnapshot: {
            lastReconciledAt: '2026-05-01T00:01:00.000Z',
            lastSeenAt: '2026-05-01T00:01:00.000Z',
            summary: { message: 'Downloading', status: 'active', total: 1 },
            transfers: [{ id: 'transfer-down', username: 'source-user' }],
          },
        },
      },
      statusMessage: '1 file accepted by slskd for download.',
      updatedAt: '2026-05-01T00:01:00.000Z',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.id, 'run-down');
  assert.equal(summary.currentRun.transferSnapshotUnavailable, true);
  assert.equal(summary.currentRun.items.length, 1);
  assert.equal(summary.currentRun.items[0].id, 'item-down');
  assert.equal(summary.currentRun.items[0].liveTransfers.length, 0);
  assert.equal(summary.currentRun.items[0].liveTransferSummary, null);
  assert.equal(summary.currentRun.items[0].transferObservationPending, true);
  assert.notEqual(summary.currentRun.items[0].persistedTransferObservation, null);
  assert.equal(summary.currentRun.items[0].persistedTransferObservation.summary.status, 'active');
  assert.equal(summary.recentRuns.length, 0);
});

test('buildImportCandidateExecutionSummary returns partial data with transferSnapshotUnavailable when slskd request fails', async () => {
  const slskdError = new Error('slskd returned 400 for download list');
  slskdError.code = 'slskd_request_failed';

  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => { throw slskdError; },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-reqfail',
        status: 'completed',
      }),
      listRecentRuns: async () => [],
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-reqfail',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-reqfail' },
        execution: {
          enqueuedTransfers: [{ id: 't-1', username: 'user-1' }],
        },
      },
      statusMessage: 'Enqueued.',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.transferSnapshotUnavailable, true);
  assert.equal(summary.currentRun.items[0].liveTransferSummary, null);
  assert.equal(summary.currentRun.items[0].transferObservationPending, true);
  assert.equal(summary.currentRun.items[0].persistedTransferObservation, null);
});

test('buildImportCandidateExecutionSummary does not catch non-slskd errors', async () => {
  const dbError = new Error('connection refused');
  dbError.code = 'ECONNREFUSED';

  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => { throw dbError; },
    importCandidateExecutionRunStore: {
      getActiveRun: async () => ({
        id: 'run-db',
        status: 'running',
      }),
      getLatestRun: async () => null,
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-db',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-db' },
        execution: {
          enqueuedTransfers: [{ id: 't-db', username: 'user-db' }],
        },
      },
      statusMessage: 'Enqueued.',
    }],
  });

  await assert.rejects(
    () => service.buildImportCandidateExecutionSummary(),
    (error) => error.code === 'ECONNREFUSED',
  );
});

test('buildImportCandidateExecutionSummary sets transferSnapshotUnavailable false when slskd is healthy', async () => {
  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => ({
      getTransfer: () => null,
    }),
    importCandidateExecutionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        blockedCount: 0,
        id: 'run-ok',
        readyCount: 1,
        status: 'completed',
      }),
      listRecentRuns: async () => [],
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-ok',
      itemStatus: 'ready',
      planningSnapshot: { candidate: { id: 'candidate-ok' } },
      statusMessage: 'Ready.',
    }],
  });

  const summary = await service.buildImportCandidateExecutionSummary();

  assert.equal(summary.currentRun.transferSnapshotUnavailable, false);
});

test('buildImportCandidateExecutionRunDetail returns partial data with transferSnapshotUnavailable when slskd is down', async () => {
  const slskdError = new Error('slskd download list request failed');
  slskdError.code = 'slskd_unavailable';

  const service = createImportCandidateExecutionSummaryService({
    buildTransferSnapshot: async () => { throw slskdError; },
    importCandidateExecutionRunStore: {
      getRunById: async () => ({
        executionMode: 'download_enqueue',
        id: 'run-detail-down',
        status: 'running',
      }),
    },
    listImportExecutionRunItemsFn: async () => [{
      id: 'item-detail-down',
      itemStatus: 'queued',
      planningSnapshot: {
        candidate: { id: 'candidate-detail-down' },
        execution: {
          enqueuedTransfers: [{ id: 't-detail', username: 'user-detail' }],
          latestTransferSnapshot: {
            lastReconciledAt: '2026-05-01T00:02:00.000Z',
            lastSeenAt: '2026-05-01T00:02:00.000Z',
            summary: { message: 'Queued', status: 'queued', total: 1 },
            transfers: [{ id: 't-detail', username: 'user-detail' }],
          },
        },
      },
      statusMessage: 'Enqueued.',
      updatedAt: '2026-05-01T00:02:00.000Z',
    }],
  });

  const detail = await service.buildImportCandidateExecutionRunDetail({ runId: 'run-detail-down' });

  assert.equal(detail.run.id, 'run-detail-down');
  assert.equal(detail.run.transferSnapshotUnavailable, true);
  assert.equal(detail.run.items.length, 1);
  assert.equal(detail.run.items[0].persistedTransferObservation.summary.status, 'queued');
  assert.equal(detail.run.items[0].liveTransferSummary, null);
  assert.equal(detail.run.items[0].transferObservationPending, true);
});
