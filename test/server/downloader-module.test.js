import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloaderModule } from '../../src/server/downloader/downloader-module.js';

test('createDownloaderModule exposes downloader queue route dependencies', () => {
  const downloaderActionService = {
    clearCompleted: () => {},
    requestTransferAction: () => {},
  };
  const downloaderQueueReadModelService = {
    buildDownloaderQueue: () => {},
  };

  const module = createDownloaderModule({
    downloaderActionService,
    downloaderQueueReadModelService,
  });

  assert.equal(module.downloaderActionService, downloaderActionService);
  assert.equal(module.downloaderQueueReadModelService, downloaderQueueReadModelService);
  assert.deepEqual(module.routeDependencies, {
    buildDownloaderQueue: downloaderQueueReadModelService.buildDownloaderQueue,
    clearCompletedDownloaderTransfers: downloaderActionService.clearCompleted,
    requestDownloaderTransferAction: downloaderActionService.requestTransferAction,
  });
});

test('createDownloaderModule builds the read model and action services from slskdService by default', async () => {
  const slskdService = {
    cancelDownload: async ({ id, remove, username }) => ({
      action: remove ? 'remove' : 'cancel',
      id,
      ok: true,
      provider: 'slskd',
      sourceUser: username,
    }),
    clearCompletedDownloads: async () => ({
      action: 'clear_completed',
      ok: true,
      provider: 'slskd',
    }),
    getDownload: async () => ({
      id: 'transfer-1',
      state: 'InProgress',
      username: 'source-user',
    }),
    getDownloads: async () => [],
  };
  const slskdConfigService = {
    buildSecretStatus: async () => ({
      apiKeyConfigured: true,
      apiKeySource: 'stored',
    }),
  };
  const module = createDownloaderModule({ slskdConfigService, slskdService });

  const result = await module.routeDependencies.buildDownloaderQueue();

  assert.equal(result.provider, 'slskd');
  assert.equal(result.providerState.enabled, true);
  assert.deepEqual(result.transfers, []);
  assert.equal(typeof module.routeDependencies.requestDownloaderTransferAction, 'function');
  assert.equal(typeof module.routeDependencies.clearCompletedDownloaderTransfers, 'function');
});

test('createDownloaderModule builds a disabled read model when slskd is not configured', async (t) => {
  const slskdService = {
    cancelDownload: async () => ({}),
    clearCompletedDownloads: async () => ({}),
    getDownload: async () => null,
    getDownloads: t.mock.fn(async () => {
      throw new Error('slskd should not be called');
    }),
  };
  const slskdConfigService = {
    buildSecretStatus: t.mock.fn(async () => ({
      apiKeyConfigured: false,
      apiKeySource: 'unset',
    })),
  };
  const module = createDownloaderModule({ slskdConfigService, slskdService });

  const result = await module.routeDependencies.buildDownloaderQueue();

  assert.equal(slskdConfigService.buildSecretStatus.mock.callCount(), 1);
  assert.equal(slskdService.getDownloads.mock.callCount(), 0);
  assert.equal(result.providerState.enabled, false);
  assert.equal(result.queueHealth.status, 'disabled');
});
