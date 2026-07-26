import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderQueueReadModelFromDownloads,
  buildDisabledDownloaderQueueReadModel,
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
  assert.deepEqual(result.providerState, {
    enabled: true,
    configured: true,
    message: 'Download provider is configured.',
    reason: null,
    status: 'enabled',
    apiKeySource: null,
    apiKeyUpdatedAt: null,
    mode: 'external',
  });
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
  assert.equal(result.transfers[0].actionEligibility.canCancel, true);
  assert.equal(result.transfers[0].actionEligibility.canRemove, false);
  assert.equal(result.transfers[0].actionEligibility.reason, 'cancel_available');
  assert.deepEqual(
    result.transfers[0].actionEligibility.actions.map((action) => ({
      code: action.code,
      enabled: action.enabled,
      reason: action.reason,
      requiresFreshSession: action.requiresFreshSession,
    })),
    [
      { code: 'cancel', enabled: true, reason: 'transfer_can_be_cancelled', requiresFreshSession: true },
      { code: 'remove', enabled: false, reason: 'remove_not_allowed_for_active', requiresFreshSession: true },
      { code: 'retry', enabled: false, reason: 'retry_provider_contract_not_available', requiresFreshSession: true },
      { code: 'pause', enabled: false, reason: 'pause_provider_contract_not_available', requiresFreshSession: true },
      { code: 'resume', enabled: false, reason: 'resume_provider_contract_not_available', requiresFreshSession: true },
    ],
  );
  assert.equal(result.transfers[1].state.code, 'failed');
  assert.equal(result.transfers[1].actionEligibility.canRemove, true);
  assert.equal(result.transfers[1].actionEligibility.reason, 'remove_available');
  assert.equal(result.transfers[1].diagnostics.provider.hasProviderError, true);
  assert.equal(result.transfers[1].diagnostics.summary.includes('withheld'), true);
  assert.equal(Object.hasOwn(result.transfers[1], 'exception'), false);
  assert.equal(result.transfers[2].state.code, 'queued');
  assert.equal(result.transfers[2].timestamps.requestedAt, null);
});

test('buildDownloaderQueueReadModelFromDownloads exposes import-candidate linkage when supplied', () => {
  const result = buildDownloaderQueueReadModelFromDownloads(sampleDownloads(), {
    importCandidateLinkageByTransferKey: new Map([[
      'source-b::transfer-active',
      {
        candidateId: 'candidate-1',
        candidateStatus: 'downloading',
        executionItemStatus: 'queued',
        linkedAt: '2026-06-20T12:00:00.000Z',
        operationRunId: 'run-1',
        sourceSearchId: 'search-1',
        status: 'linked',
        summary: 'Linked to Import Review candidate.',
      },
    ]]),
    now: () => observedAt,
  });

  assert.deepEqual(result.transfers[0].diagnostics.importLinkage, {
    candidateId: 'candidate-1',
    candidateStatus: 'downloading',
    executionItemStatus: 'queued',
    linkedAt: '2026-06-20T12:00:00.000Z',
    operationRunId: 'run-1',
    requestId: null,
    sourceSearchId: 'search-1',
    status: 'linked',
    summary: 'Linked to Import Review candidate.',
  });
  assert.equal(result.transfers[1].diagnostics.importLinkage.status, 'not_linked');
});

test('buildDownloaderQueueReadModelFromDownloads reports idle empty queues', () => {
  const result = buildDownloaderQueueReadModelFromDownloads([], {
    now: () => observedAt,
  });

  assert.equal(result.queueHealth.status, 'idle');
  assert.equal(result.queueHealth.message, 'No active downloads right now.');
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

test('buildDisabledDownloaderQueueReadModel reports static setup state', () => {
  const result = buildDisabledDownloaderQueueReadModel({
    includeRemoved: true,
    now: () => observedAt,
    providerStatus: {
      apiKeyConfigured: false,
      apiKeySource: 'unset',
    },
  });

  assert.equal(result.provider, 'slskd');
  assert.equal(result.observedAt, observedAt);
  assert.equal(result.includeRemoved, true);
  assert.deepEqual(result.providerState, {
    enabled: false,
    configured: false,
    message: 'Configure Soulseek (slskd) in Settings to enable downloads.',
    reason: 'missing_api_key',
    status: 'disabled',
    apiKeySource: 'unset',
    apiKeyUpdatedAt: null,
    mode: 'external',
  });
  assert.equal(result.queueHealth.status, 'disabled');
  assert.equal(result.queueHealth.message, 'Downloads are disabled until Soulseek (slskd) is configured.');
  assert.deepEqual(result.queueHealth.counts, {
    active: 0,
    completed: 0,
    failed: 0,
    other: 0,
    queued: 0,
    total: 0,
  });
  assert.deepEqual(result.transfers, []);
  assert.deepEqual(result.sourceGroups, []);
  assert.equal(result.truncated, false);
});

test('createDownloaderQueueReadModelService delegates to getDownloads and normalizes includeRemoved', async (t) => {
  const getDownloads = t.mock.fn(async ({ includeRemoved }) => {
    assert.equal(includeRemoved, true);
    return sampleDownloads();
  });
  const getDownloaderProviderStatus = t.mock.fn(async () => ({
    apiKeyConfigured: true,
    apiKeySource: 'stored',
    apiKeyUpdatedAt: '2026-06-01T12:00:00.000Z',
  }));
  const service = createDownloaderQueueReadModelService({
    buildTransferImportCandidateLinkage: async () => new Map(),
    getDownloaderProviderStatus,
    getDownloads,
    now: () => observedAt,
  });

  const result = await service.buildDownloaderQueue({ includeRemoved: '1' });

  assert.equal(getDownloaderProviderStatus.mock.callCount(), 1);
  assert.equal(getDownloads.mock.callCount(), 1);
  assert.equal(result.includeRemoved, true);
  assert.deepEqual(result.providerState, {
    enabled: true,
    configured: true,
    message: 'Download provider is configured.',
    reason: null,
    status: 'enabled',
    apiKeySource: 'stored',
    apiKeyUpdatedAt: '2026-06-01T12:00:00.000Z',
    mode: 'external',
  });
  assert.equal(result.transfers.length, 3);
});

test('createDownloaderQueueReadModelService does not poll when Soulseek is disabled in Settings', async (t) => {
  const getDownloads = t.mock.fn(async () => {
    throw new Error('slskd should not be called');
  });
  const service = createDownloaderQueueReadModelService({
    getDownloads,
    getDownloaderProviderStatus: async () => ({
      apiKeyConfigured: true,
      apiKeySource: 'stored',
      providerMode: 'disabled',
    }),
    now: () => observedAt,
  });

  const result = await service.buildDownloaderQueue();

  assert.equal(getDownloads.mock.callCount(), 0);
  assert.equal(result.providerState.reason, 'disabled_by_setting');
  assert.equal(result.providerState.message, 'Soulseek downloads are turned off in Settings.');
  assert.equal(result.queueHealth.message, 'Soulseek downloads are turned off in Settings.');
});

test('createDownloaderQueueReadModelService enriches downloads with import-candidate linkage', async (t) => {
  const buildTransferImportCandidateLinkage = t.mock.fn(async ({ transfers }) => {
    assert.deepEqual(transfers, [
      { id: 'transfer-active', sourceUser: 'source-b', transferKey: 'source-b::transfer-active' },
      { id: 'transfer-failed', sourceUser: 'source-b', transferKey: 'source-b::transfer-failed' },
      { id: 'transfer-queued', sourceUser: 'source-a', transferKey: 'source-a::transfer-queued' },
    ]);
    return new Map([[
      'source-a::transfer-queued',
      {
        candidateId: 'candidate-queued',
        candidateStatus: 'downloading',
        executionItemStatus: 'queued',
        status: 'linked',
      },
    ]]);
  });
  const service = createDownloaderQueueReadModelService({
    buildTransferImportCandidateLinkage,
    getDownloaderProviderStatus: async () => ({ apiKeyConfigured: true }),
    getDownloads: async () => sampleDownloads(),
    now: () => observedAt,
  });

  const result = await service.buildDownloaderQueue();

  assert.equal(buildTransferImportCandidateLinkage.mock.callCount(), 1);
  assert.equal(result.transfers[2].diagnostics.importLinkage.candidateId, 'candidate-queued');
  assert.equal(result.transfers[2].diagnostics.importLinkage.status, 'linked');
});

test('createDownloaderQueueReadModelService does not call slskd when provider is unconfigured', async (t) => {
  const getDownloads = t.mock.fn(async () => {
    throw new Error('slskd should not be called');
  });
  const buildTransferImportCandidateLinkage = t.mock.fn(async () => {
    throw new Error('linkage should not be called');
  });
  const getDownloaderProviderStatus = t.mock.fn(async () => ({
    apiKeyConfigured: false,
    apiKeySource: 'unset',
  }));
  const service = createDownloaderQueueReadModelService({
    buildTransferImportCandidateLinkage,
    getDownloaderProviderStatus,
    getDownloads,
    now: () => observedAt,
  });

  const result = await service.buildDownloaderQueue();

  assert.equal(getDownloaderProviderStatus.mock.callCount(), 1);
  assert.equal(getDownloads.mock.callCount(), 0);
  assert.equal(buildTransferImportCandidateLinkage.mock.callCount(), 0);
  assert.equal(result.providerState.enabled, false);
  assert.equal(result.queueHealth.status, 'disabled');
  assert.deepEqual(result.transfers, []);
});

test('createDownloaderQueueReadModelService requires a getDownloads dependency', () => {
  assert.throws(
    () => createDownloaderQueueReadModelService(),
    /requires getDownloads/,
  );
});
