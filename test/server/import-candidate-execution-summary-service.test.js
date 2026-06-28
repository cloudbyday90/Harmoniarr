import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';

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
  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'not_found');
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
  assert.equal(summary.currentRun.items[0].liveTransferSummary.status, 'not_found');
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
  assert.equal(detail.run.items[0].liveTransferSummary.status, 'not_found');
});
