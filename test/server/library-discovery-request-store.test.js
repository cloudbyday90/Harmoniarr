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

test('releaseFolderSetupBlockedAutomaticDiscoveryRequests only requeues bounded automatic folder-gated cooldowns', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /search_mode = 'automatic'/);
    assert.match(sql, /request_status = 'cooldown'/);
    assert.match(sql, /blocked_reason = 'automatic_cooldown'/);
    assert.match(sql, /autoDownloadReadiness'->>'setupReason' = ANY\(\$2::text\[\]\)/);
    assert.match(sql, /downloadRecoveryRediscovery' IS NULL/);
    assert.match(sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(sql, /LIMIT \$3::integer/);
    assert.match(sql, /#- '\{lastSearchResult,autoDownloadReadiness\}'/);
    assert.deepEqual(params, [
      '2026-07-26T15:00:00.000Z',
      ['missing_download_folder', 'download_folder_unavailable'],
      5,
    ]);
    return { rows: [{ released_count: 2 }] };
  });
  const store = createLibraryDiscoveryRequestStore({ getPoolFn: () => ({ query }) });

  const releasedCount = await store.releaseFolderSetupBlockedAutomaticDiscoveryRequests({
    limit: 5,
    releasedAt: '2026-07-26T15:00:00.000Z',
  });

  assert.equal(releasedCount, 2);
  assert.equal(query.mock.callCount(), 1);
});

test('recordDiscoverySearchFailure casts JSON evidence parameters for PostgreSQL inference', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /'code', \$1::text/);
    assert.match(sql, /'message', \$2::text/);
    assert.match(sql, /'lastSearchQuery', \$3::text/);
    assert.deepEqual(params, [
      'discovery_dispatch_failed',
      'Soulseek search failed',
      'Autechre Amber',
      'release-1',
    ]);
    return { rows: [] };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  await store.recordDiscoverySearchFailure({
    errorCode: 'discovery_dispatch_failed',
    errorMessage: 'Soulseek search failed',
    metadataReleaseId: 'release-1',
    searchQuery: 'Autechre Amber',
  });

  assert.equal(query.mock.callCount(), 1);
});

test('recordDiscoverySearchSuccess persists fallback scheduling metadata', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /'lastSearchId', \$1::text/);
    assert.match(sql, /'lastSearchQuery', \$2::text/);
    assert.match(sql, /'candidateCount', \$3::integer/);
    assert.match(sql, /'autoDownloadReadiness', \$10::jsonb/);
    assert.match(sql, /'autoSelection', \$9::jsonb/);
    assert.match(sql, /'fileCount', \$4::integer/);
    assert.match(sql, /'ingestionDiagnostics', \$8::jsonb/);
    assert.deepEqual(params, [
      'search-1',
      'Bjork Vespertine Live',
      0,
      0,
      'release-1',
      2,
      '2026-04-30T16:00:00.000Z',
      JSON.stringify({
        provider: 'slskd',
        reasonCodes: ['no_provider_responses'],
        responseCount: 0,
      }),
      JSON.stringify({
        attempted: true,
        selected: false,
        skippedReason: 'no_candidates',
      }),
      null,
    ]);
    return { rows: [] };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  await store.recordDiscoverySearchSuccess({
    autoSelection: {
      attempted: true,
      selected: false,
      skippedReason: 'no_candidates',
    },
    candidateCount: 0,
    fileCount: 0,
    ingestionDiagnostics: {
      provider: 'slskd',
      reasonCodes: ['no_provider_responses'],
      responseCount: 0,
    },
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-04-30T16:00:00.000Z',
    searchAttemptCount: 2,
    searchId: 'search-1',
    searchQuery: 'Bjork Vespertine Live',
  });

  assert.equal(query.mock.callCount(), 1);
});

test('markDiscoveryRequestExhausted blocks automatic discovery retries', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /'lastSearchQuery', \$2::text/);
    assert.match(sql, /'reasonCode', \$4::text/);
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

test('markDueAutomaticDiscoveryRequestsProviderPaused marks due automatic work without raw provider errors', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /request_status = 'ready'/);
    assert.match(sql, /COALESCE\(next_search_after, \$1::timestamptz\) <= \$1::timestamptz/);
    assert.match(sql, /'providerRecoveryPending'/);
    assert.deepEqual(params, [
      '2026-07-26T12:00:00.000Z',
      'slskd',
      'slskd_unavailable',
    ]);
    return { rowCount: 2, rows: [] };
  });
  const store = createLibraryDiscoveryRequestStore({ getPoolFn: () => ({ query }) });

  const markedCount = await store.markDueAutomaticDiscoveryRequestsProviderPaused({
    markedAt: '2026-07-26T12:00:00.000Z',
    pauseCode: 'slskd_unavailable',
  });

  assert.equal(markedCount, 2);
});

test('consumeProviderRecoveryPending atomically clears one durable provider-recovery marker', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /- 'providerRecoveryPending'/);
    assert.match(sql, /WHERE id = \$1::uuid/);
    assert.deepEqual(params, ['discovery-request-1']);
    return {
      rows: [{
        provider_recovery: {
          markedAt: '2026-07-26T12:00:00.000Z',
          pauseCode: 'slskd_unavailable',
          provider: 'slskd',
          schemaVersion: 1,
        },
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({ getPoolFn: () => ({ query }) });

  const marker = await store.consumeProviderRecoveryPending({ discoveryRequestId: ' discovery-request-1 ' });

  assert.deepEqual(marker, {
    markedAt: '2026-07-26T12:00:00.000Z',
    pauseCode: 'slskd_unavailable',
    provider: 'slskd',
    schemaVersion: 1,
  });
  assert.equal(await store.consumeProviderRecoveryPending({ discoveryRequestId: null }), null);
});

test('requestMusicQueueRediscovery resets one release into ready automatic search state', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /request_status = 'ready'/);
    assert.match(sql, /next_search_after = \$2::timestamptz/);
    assert.match(sql, /- 'downloadRecoveryExhausted'/);
    assert.match(sql, /- 'downloadRecoveryRediscovery'/);
    assert.match(sql, /- 'searchExhausted'/);
    assert.match(sql, /'musicQueueRediscovery'/);
    assert.deepEqual(params, [
      'release-1',
      '2026-06-29T12:00:00.000Z',
      'quality_choice_search_again',
      'user-1',
      'wanted-1',
    ]);
    return {
      rows: [{
        blocked_reason: null,
        evidence: {
          musicQueueRediscovery: {
            reasonCode: 'quality_choice_search_again',
            requestedAt: '2026-06-29T12:00:00.000Z',
          },
        },
        last_search_at: '2026-06-29T10:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-06-29T12:00:00.000Z',
        research_attempt_count: 0,
        release_date: '2026-06-01',
        release_group_title: 'Child of God',
        release_title: 'Child of God',
        request_status: 'ready',
        search_attempt_count: 0,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.requestMusicQueueRediscovery({
    metadataReleaseId: 'release-1',
    reasonCode: 'quality_choice_search_again',
    requestedAt: '2026-06-29T12:00:00.000Z',
    requestedByUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.requestStatus, 'ready');
  assert.equal(result.blockedReason, null);
  assert.equal(result.nextSearchAfter, '2026-06-29T12:00:00.000Z');
});

test('allowMusicQueueFallbackQuality records override and queues rediscovery', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /'musicQueueQualityOverride'/);
    assert.match(sql, /'mode', 'allow_fallback_quality'/);
    assert.match(sql, /'musicQueueRediscovery'/);
    assert.match(sql, /'quality_fallback_search_again'/);
    assert.deepEqual(params, [
      'release-1',
      '2026-06-29T13:00:00.000Z',
      'user-1',
      'wanted-1',
      'lossless_archive',
      'operator_allowed_fallback_quality',
    ]);
    return {
      rows: [{
        blocked_reason: null,
        evidence: {
          musicQueueQualityOverride: {
            mode: 'allow_fallback_quality',
          },
          musicQueueRediscovery: {
            reasonCode: 'quality_fallback_search_again',
          },
        },
        last_search_at: '2026-06-29T10:00:00.000Z',
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        next_search_after: '2026-06-29T13:00:00.000Z',
        research_attempt_count: 0,
        release_date: '2026-06-01',
        release_group_title: 'Child of God',
        release_title: 'Child of God',
        request_status: 'ready',
        search_attempt_count: 0,
        search_mode: 'automatic',
        wanted_status: 'missing',
      }],
    };
  });
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.allowMusicQueueFallbackQuality({
    allowedAt: '2026-06-29T13:00:00.000Z',
    allowedByUserId: 'user-1',
    metadataReleaseId: 'release-1',
    priorQualityProfile: 'lossless_archive',
    reasonCode: 'operator_allowed_fallback_quality',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.requestStatus, 'ready');
  assert.equal(result.blockedReason, null);
  assert.equal(result.evidence.musicQueueQualityOverride.mode, 'allow_fallback_quality');
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

test('replaceLibraryDiscoveryRequests normalizes partial release dates before insert', async (t) => {
  const queries = [];
  const client = {
    query: t.mock.fn(async (sql, params) => {
      queries.push({ params, sql });
      return { rows: [] };
    }),
    release: t.mock.fn(),
  };
  const store = createLibraryDiscoveryRequestStore({
    getPoolFn: () => ({
      connect: async () => client,
    }),
  });

  await store.replaceLibraryDiscoveryRequests({
    discoveryRequests: [{
      blockedReason: null,
      evidence: { strategy: 'eligible_now' },
      lastSearchAt: null,
      manualRequestedAt: null,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-1',
      metadataReleaseId: 'release-1',
      nextSearchAfter: '2026-06-01T00:00:00.000Z',
      releaseDate: '2000',
      requestStatus: 'ready',
      searchAttemptCount: 0,
      searchMode: 'automatic',
      wantedStatus: 'missing',
    }],
  });

  const insertQuery = queries.find((entry) => entry.sql.includes('INSERT INTO library_discovery_requests'));
  assert.equal(insertQuery.params[7], '2000-01-01');
  assert.equal(client.release.mock.callCount(), 1);
});
