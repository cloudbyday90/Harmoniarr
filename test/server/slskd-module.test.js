import assert from 'node:assert/strict';
import test from 'node:test';
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
