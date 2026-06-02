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

test('scheduleDownloadRecoveryRediscovery records delayed automatic rediscovery state', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /research_attempt_count = research_attempt_count \+ 1/);
    assert.match(sql, /evidence \? 'downloadRecoveryRediscovery'/);
    assert.deepEqual(params, [
      'release-1',
      '2026-05-01T02:00:00.000Z',
      1,
      2,
      'candidate-1',
      'Download enqueue failed.',
      'run-1',
      'search-1',
    ]);
    return {
      rows: [{
        blocked_reason: null,
        evidence: {
          downloadRecoveryRediscovery: {
            nextSearchAfter: '2026-05-01T02:00:00.000Z',
          },
        },
        last_search_at: '2026-05-01T00:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-05-01T02:00:00.000Z',
        research_attempt_count: 1,
        release_date: '2026-04-25',
        request_status: 'ready',
        search_attempt_count: 1,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.scheduleDownloadRecoveryRediscovery({
    failureReason: 'Download enqueue failed.',
    maxResearchAttemptCount: 2,
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    searchAttemptCount: 1,
    sourceOperationRunId: 'run-1',
    sourceSearchId: 'search-1',
    triggeredByFailedCandidateId: 'candidate-1',
  });

  assert.deepEqual(result, {
    artistName: null,
    blockedReason: null,
    evidence: {
      downloadRecoveryRediscovery: {
        nextSearchAfter: '2026-05-01T02:00:00.000Z',
      },
    },
    lastSearchAt: '2026-05-01T00:00:00.000Z',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-1',
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-05-01T02:00:00.000Z',
    researchAttemptCount: 1,
    releaseDate: '2026-04-25',
    releaseGroupTitle: null,
    releaseTitle: null,
    requestStatus: 'ready',
    searchAttemptCount: 1,
    searchMode: 'automatic',
    wantedStatus: 'missing',
  });
});

test('getDownloadRecoveryRediscoveryState returns joined release context', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, ['release-1']);
    return {
      rows: [{
        artist_name: 'Autechre',
        blocked_reason: null,
        evidence: { downloadRecoveryRediscovery: {} },
        last_search_at: '2026-05-01T00:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-05-01T02:00:00.000Z',
        release_date: '2026-04-25',
        release_group_title: 'Amber',
        release_title: 'Amber',
        request_status: 'ready',
        research_attempt_count: 2,
        search_attempt_count: 1,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.getDownloadRecoveryRediscoveryState({
    metadataReleaseId: 'release-1',
  });

  assert.equal(result.artistName, 'Autechre');
  assert.equal(result.releaseTitle, 'Amber');
  assert.equal(result.researchAttemptCount, 2);
});

test('markDownloadRecoveryRediscoveryExhausted blocks the request with recovery evidence', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /blocked_reason = 'download_recovery_exhausted'/);
    assert.match(sql, /research_attempt_count >= \$2::integer/);
    assert.deepEqual(params, [
      'release-1',
      2,
      'candidate-1',
      'Download enqueue failed.',
      'run-1',
      'search-1',
    ]);
    return {
      rows: [{
        artist_name: 'Autechre',
        blocked_reason: 'download_recovery_exhausted',
        evidence: {
          downloadRecoveryExhausted: {
            maxResearchAttemptCount: 2,
          },
        },
        last_search_at: '2026-05-01T00:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: null,
        release_date: '2026-04-25',
        release_group_title: 'Amber',
        release_title: 'Amber',
        request_status: 'blocked',
        research_attempt_count: 2,
        search_attempt_count: 1,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.markDownloadRecoveryRediscoveryExhausted({
    failureReason: 'Download enqueue failed.',
    maxResearchAttemptCount: 2,
    metadataReleaseId: 'release-1',
    sourceOperationRunId: 'run-1',
    sourceSearchId: 'search-1',
    triggeredByFailedCandidateId: 'candidate-1',
  });

  assert.equal(result.blockedReason, 'download_recovery_exhausted');
  assert.equal(result.requestStatus, 'blocked');
  assert.equal(result.artistName, 'Autechre');
  assert.equal(result.releaseTitle, 'Amber');
});

test('resetDownloadRecoveryExhaustion clears exhausted state and records manual retry evidence', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /blocked_reason = 'download_recovery_exhausted'/);
    assert.match(sql, /search_attempt_count = 0/);
    assert.match(sql, /research_attempt_count = 0/);
    assert.match(sql, /- 'downloadRecoveryExhausted'/);
    assert.match(sql, /manualDownloadRecoveryRetry/);
    assert.deepEqual(params, [
      'release-1',
      '2026-06-01T12:00:00.000Z',
      'admin-1',
    ]);
    return {
      rows: [{
        artist_name: 'Autechre',
        blocked_reason: null,
        evidence: {
          manualDownloadRecoveryRetry: {
            priorBlockedReason: 'download_recovery_exhausted',
            priorResearchAttemptCount: 2,
            priorSearchAttemptCount: 1,
            resetAt: '2026-06-01T12:00:00.000Z',
            resetByUserId: 'admin-1',
          },
        },
        last_search_at: null,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-06-01T12:00:00.000Z',
        release_date: '2026-04-25',
        release_group_title: 'Amber',
        release_title: 'Amber',
        request_status: 'ready',
        research_attempt_count: 0,
        search_attempt_count: 0,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.resetDownloadRecoveryExhaustion({
    metadataReleaseId: 'release-1',
    resetAt: '2026-06-01T12:00:00.000Z',
    resetByUserId: 'admin-1',
  });

  assert.equal(result.blockedReason, null);
  assert.equal(result.requestStatus, 'ready');
  assert.equal(result.researchAttemptCount, 0);
  assert.equal(result.searchAttemptCount, 0);
  assert.equal(result.evidence.manualDownloadRecoveryRetry.resetByUserId, 'admin-1');
});
