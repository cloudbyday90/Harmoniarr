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
  const module = createDownloaderModule({ slskdService });

  const result = await module.routeDependencies.buildDownloaderQueue();

  assert.equal(result.provider, 'slskd');
  assert.deepEqual(result.transfers, []);
  assert.equal(typeof module.routeDependencies.requestDownloaderTransferAction, 'function');
  assert.equal(typeof module.routeDependencies.clearCompletedDownloaderTransfers, 'function');
});
