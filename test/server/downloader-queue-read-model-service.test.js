import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderQueueReadModelFromDownloads,
  createDownloaderQueueReadModelService,
} from '../../src/server/downloader/downloader-queue-read-model-service.js';

const observedAt = '2026-06-06T12:00:00.000Z';

function sampleDownloads() {
  return [{
    username: 'source-b',
    directories: [{
      directory: 'Autechre\\Amber',
      files: [{
        averageSpeed: 1024,
        bytesTransferred: 50,
        enqueuedAt: '2026-06-06T11:59:00.000Z',
        filename: 'Autechre\\Amber\\01 Foil.flac',
        id: 'transfer-active',
        placeInQueue: 0,
        size: 100,
        startedAt: '2026-06-06T11:59:30.000Z',
        state: 'InProgress',
      }, {
        filename: 'Autechre\\Amber\\02 Montreal.flac',
        id: 'transfer-failed',
        exception: 'Remote transfer failed with provider detail',
        size: 100,
        state: 'Completed, Errored',
      }],
    }],
  }, {
    username: 'source-a',
    directories: [{
      directory: 'Boards of Canada/Music Has the Right to Children',
      files: [{
        averageSpeed: 0,
        bytesTransferred: 0,
        filename: 'Boards of Canada/Music Has the Right to Children/01 Wildlife Analysis.flac',
        id: 'transfer-queued',
        placeInQueue: 4,
        requestedAt: 'not-a-date',
        size: 300,
        state: 'Queued, Remotely',
      }],
    }],
  }];
}

test('buildDownloaderQueueReadModelFromDownloads normalizes transfers, counts, progress, and source groups', () => {
  const result = buildDownloaderQueueReadModelFromDownloads(sampleDownloads(), {
    includeRemoved: true,
    now: () => new Date(observedAt),
  });

  assert.equal(result.provider, 'slskd');
  assert.equal(result.observedAt, observedAt);
  assert.equal(result.includeRemoved, true);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.queueHealth.counts, {
    active: 1,
    completed: 0,
    failed: 1,
    other: 0,
    queued: 1,
    total: 3,
  });
  assert.equal(result.queueHealth.status, 'attention');
  assert.equal(result.queueHealth.message, '1 transfer needs attention.');
  assert.deepEqual(result.queueHealth.progress, {
    bytesTransferred: 50,
    percentComplete: 13,
    size: 400,
  });
  assert.deepEqual(result.sourceGroups.map((group) => group.sourceUser), ['source-a', 'source-b']);
  assert.equal(result.transfers[0].sourceUser, 'source-b');
  assert.equal(result.transfers[0].directory, 'Autechre\\Amber');
  assert.equal(result.transfers[0].state.code, 'active');
  assert.equal(result.transfers[0].state.label, 'Downloading');
  assert.equal(result.transfers[0].state.tone, 'warning');
  assert.deepEqual(result.transfers[0].progress, {
    bytesTransferred: 50,
    percentComplete: 50,
    size: 100,
  });
  assert.deepEqual(result.transfers[0].diagnostics, {
    importLinkage: {
      candidateId: null,
      requestId: null,
      status: 'not_linked',
      summary: 'No request or import-candidate linkage is exposed for this live provider row yet.',
    },
    provider: {
      hasProviderError: false,
      name: 'slskd',
      state: 'InProgress',
    },
    queue: {
      hasQueuePosition: true,
      placeInQueue: 0,
    },
    recommendedNextAction: {
      code: 'monitor_progress',
      description: 'Keep watching progress and speed before taking operator action.',
      label: 'Monitor progress',
      tone: 'info',
    },
    retry: {
      attempts: null,
      status: 'not_tracked',
      summary: 'Retry attempts are not tracked by Harmoniarr for live provider rows yet.',
    },
    severity: 'info',
    summary: 'The transfer is actively downloading at 50%.',
    timing: {
      lastKnownEventAt: '2026-06-06T11:59:30.000Z',
    },
  });
  assert.equal(result.transfers[0].timestamps.startedAt, '2026-06-06T11:59:30.000Z');
  assert.deepEqual(result.transfers[0].actionEligibility, {
    canCancel: false,
    canClear: false,
    canRetry: false,
    reason: 'actions_not_designed',
  });
  assert.equal(result.transfers[1].state.code, 'failed');
  assert.equal(result.transfers[1].diagnostics.provider.hasProviderError, true);
  assert.equal(result.transfers[1].diagnostics.summary.includes('withheld'), true);
  assert.equal(Object.hasOwn(result.transfers[1], 'exception'), false);
  assert.equal(result.transfers[2].state.code, 'queued');
  assert.equal(result.transfers[2].timestamps.requestedAt, null);
});

test('buildDownloaderQueueReadModelFromDownloads reports idle empty queues', () => {
  const result = buildDownloaderQueueReadModelFromDownloads([], {
    now: () => observedAt,
  });

  assert.equal(result.queueHealth.status, 'idle');
  assert.equal(result.queueHealth.message, 'No transfers are currently visible.');
  assert.deepEqual(result.queueHealth.progress, {
    bytesTransferred: null,
    percentComplete: null,
    size: null,
  });
  assert.deepEqual(result.transfers, []);
  assert.deepEqual(result.sourceGroups, []);
});

test('buildDownloaderQueueReadModelFromDownloads caps rows and reports truncation', () => {
  const result = buildDownloaderQueueReadModelFromDownloads(sampleDownloads(), {
    maxTransferRows: 2,
    now: () => observedAt,
  });

  assert.equal(result.truncated, true);
  assert.equal(result.transfers.length, 2);
  assert.equal(result.queueHealth.counts.total, 2);
});

test('createDownloaderQueueReadModelService delegates to getDownloads and normalizes includeRemoved', async (t) => {
  const getDownloads = t.mock.fn(async ({ includeRemoved }) => {
    assert.equal(includeRemoved, true);
    return sampleDownloads();
  });
  const service = createDownloaderQueueReadModelService({
    getDownloads,
    now: () => observedAt,
  });

  const result = await service.buildDownloaderQueue({ includeRemoved: '1' });

  assert.equal(getDownloads.mock.callCount(), 1);
  assert.equal(result.includeRemoved, true);
  assert.equal(result.transfers.length, 3);
});

test('createDownloaderQueueReadModelService requires a getDownloads dependency', () => {
  assert.throws(
    () => createDownloaderQueueReadModelService(),
    /requires getDownloads/,
  );
});
