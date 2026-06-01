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
        research_attempt_count: 1,
        release_date: '2026-05-01',
        request_status: 'cooldown',
        search_attempt_count: 2,
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
    researchAttemptCount: 1,
    releaseDate: '2026-05-01',
    requestStatus: 'cooldown',
    searchAttemptCount: 2,
    searchMode: 'automatic',
    wantedStatus: 'missing',
  }]);
});

test('recordDiscoverySearchSuccess persists fallback scheduling metadata', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [
      'search-1',
      'Bjork Vespertine Live',
      0,
      0,
      'release-1',
      2,
      '2026-04-30T16:00:00.000Z',
    ]);
    return { rows: [] };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  await store.recordDiscoverySearchSuccess({
    candidateCount: 0,
    fileCount: 0,
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-04-30T16:00:00.000Z',
    searchAttemptCount: 2,
    searchId: 'search-1',
    searchQuery: 'Bjork Vespertine Live',
  });

  assert.equal(query.mock.callCount(), 1);
});

test('markDiscoveryRequestExhausted blocks automatic discovery retries', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [
      'release-1',
      'Selected Ambient Works Volume II',
      3,
      'discovery_search_attempts_exhausted',
    ]);
    return { rows: [] };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  await store.markDiscoveryRequestExhausted({
    metadataReleaseId: 'release-1',
    reasonCode: 'discovery_search_attempts_exhausted',
    searchAttemptCount: 3,
    searchQuery: 'Selected Ambient Works Volume II',
  });

  assert.equal(query.mock.callCount(), 1);
});
