import assert from 'node:assert/strict';
import test from 'node:test';
import { createAcquisitionPipelineStore } from '../../src/server/acquisition/acquisition-pipeline-store.js';

test('acquisition detail resolves its owned wanted identity directly rather than scanning a capped list', async (t) => {
  const buildLibraryWantedReleases = t.mock.fn(async () => ({ wantedReleases: [] }));
  const listWantedReleasesWithMetadata = t.mock.fn(async () => [{ id: 'wanted-2001', appUserId: 'recipient' }]);
  const store = createAcquisitionPipelineStore({ buildLibraryWantedReleases, listWantedReleasesWithMetadata });
  assert.equal((await store.getWantedReleaseEvidence({ appUserId: 'recipient', wantedReleaseId: 'wanted-2001' })).id, 'wanted-2001');
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0], { appUserId: 'recipient', limit: 1, wantedReleaseId: 'wanted-2001' });
  assert.equal(buildLibraryWantedReleases.mock.callCount(), 0);
});
