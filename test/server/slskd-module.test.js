import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createSlskdModule } from '../../src/server/slskd/slskd-module.js';

test('createSlskdModule exposes shared slskd dependencies', () => {
  const providerHealthRecorder = {
    recordError: () => {},
    recordSuccess: () => {},
  };
  const slskdService = {
    getConnectionStatus: () => {},
    getDownload: () => {},
    getDownloads: () => {},
    getSearchResponses: () => {},
    getSearchState: () => {},
    startSearch: () => {},
  };
  const slskdTransferSnapshotService = {
    buildTransferSnapshot: () => {},
  };

  const slskdModule = createSlskdModule({
    providerHealthRecorder,
    slskdService,
    slskdTransferSnapshotService,
  });

  assert.equal(slskdModule.providerHealthRecorder, providerHealthRecorder);
  assert.equal(slskdModule.slskdService, slskdService);
  assert.equal(slskdModule.slskdTransferSnapshotService, slskdTransferSnapshotService);
  assert.deepEqual(slskdModule.routeDependencies, {
    getConnectionStatus: slskdService.getConnectionStatus,
    getDownload: slskdService.getDownload,
    getDownloads: slskdService.getDownloads,
    getSearchResponses: slskdService.getSearchResponses,
    getSearchState: slskdService.getSearchState,
    startSearch: slskdService.startSearch,
  });
});

test('default module forwards the owning client for pinned configuration checks', async (t) => {
  const contexts = [];
  let reads = 0;
  t.mock.method(globalThis, 'fetch', async () => { reads += 1; return Response.json('0.26.0'); });
  const module = createSlskdModule({ slskdConfigService: { buildRuntimeConfig: async (queryable) => {
    contexts.push(queryable); return { baseUrl: 'http://localhost:5030', apiKey: 'test-key' };
  } } });
  const dispatch = await module.slskdService.prepareDownloadDispatch();
  const owningClient = { query: async () => ({ rows: [] }) };
  await dispatch.assertCurrent({ queryable: owningClient });
  assert.equal(contexts.at(-1), owningClient);
  assert.equal(reads, 1, 'the local assertion does not call the provider');
});

test('assembled provider module observes removed successful receipts by exact ID', async (t) => {
  const id = randomUUID();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(new URL(url).pathname);
    return Response.json({ id, username: 'test-peer', direction: 'Download', filename: 'Album\\Track.flac',
      size: 100, state: 'Completed, Succeeded', removed: true });
  });
  const module = createSlskdModule({ slskdConfigService: { buildRuntimeConfig: async () => ({ baseUrl: 'http://localhost:5030', apiKey: 'test-key' }) } });
  const snapshot = await module.slskdTransferSnapshotService.buildTransferSnapshot({ requestedTransfers: [{ id, username: 'test-peer' }] });
  const transfer = snapshot.getTransfer({ id, username: 'test-peer' });
  assert.equal(transfer?.removed, true);
  assert.equal(transfer.state, 'Completed, Succeeded');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endsWith(`/${id}`), true);
});
