import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloaderModule } from '../../src/server/downloader/downloader-module.js';

test('createDownloaderModule exposes downloader queue route dependencies', () => {
  const downloaderQueueReadModelService = {
    buildDownloaderQueue: () => {},
  };

  const module = createDownloaderModule({
    downloaderQueueReadModelService,
  });

  assert.equal(module.downloaderQueueReadModelService, downloaderQueueReadModelService);
  assert.deepEqual(module.routeDependencies, {
    buildDownloaderQueue: downloaderQueueReadModelService.buildDownloaderQueue,
  });
});

test('createDownloaderModule builds the read model service from slskdService by default', async () => {
  const slskdService = {
    getDownloads: async () => [],
  };
  const module = createDownloaderModule({ slskdService });

  const result = await module.routeDependencies.buildDownloaderQueue();

  assert.equal(result.provider, 'slskd');
  assert.deepEqual(result.transfers, []);
});
