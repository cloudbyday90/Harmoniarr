import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';

test('listDiscoveryRequestsByMetadataReleaseIds returns current request state for targeted releases', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [['release-1', 'release-2']]);
    return {
      rows: [{
        blocked_reason: 'automatic_cooldown',
        evidence: { strategy: 'cooldown_gate' },
        last_search_at: '2026-05-25T15:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-05-25T21:00:00.000Z',
        release_date: '2026-05-01',
        request_status: 'cooldown',
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const requests = await store.listDiscoveryRequestsByMetadataReleaseIds({
    metadataReleaseIds: ['release-1', 'release-2'],
  });

  assert.deepEqual(requests, [{
    blockedReason: 'automatic_cooldown',
    evidence: { strategy: 'cooldown_gate' },
    lastSearchAt: '2026-05-25T15:00:00.000Z',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-1',
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-25T21:00:00.000Z',
    releaseDate: '2026-05-01',
    requestStatus: 'cooldown',
    searchMode: 'automatic',
    wantedStatus: 'missing',
  }]);
});
