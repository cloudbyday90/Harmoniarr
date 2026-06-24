import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';

test('reconcileDiscoveryRequests records ready, cooldown, and blocked automatic requests from wanted releases', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    automaticCooldownMs: 6 * 60 * 60 * 1000,
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          {
            blocked_reason: null,
            last_search_at: null,
            manual_requested_at: null,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-1',
            metadata_release_id: 'release-1',
            release_date: '2026-04-01',
            search_mode: 'automatic',
            wanted_status: 'missing',
            wanted_strategy: 'monitored_release_absent',
          },
          {
            blocked_reason: null,
            last_search_at: '2026-04-30T12:00:00.000Z',
            manual_requested_at: null,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-2',
            metadata_release_id: 'release-2',
            release_date: '2026-04-15',
            search_mode: 'automatic',
            wanted_status: 'partial',
            wanted_strategy: 'monitored_release_gap',
          },
          {
            blocked_reason: null,
            last_search_at: null,
            manual_requested_at: null,
            metadata_artist_id: 'artist-1',
            metadata_release_group_id: 'release-group-3',
            metadata_release_id: 'release-3',
            release_date: '2026-05-15',
            search_mode: 'automatic',
            wanted_status: 'missing',
            wanted_strategy: 'monitored_release_absent',
          },
        ],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [
      {
        blockedReason: null,
        evidence: {
          automaticCooldownMs: 21600000,
          cooldownDeadline: null,
          releaseDateGate: '2026-04-01T00:00:00.000Z',
          strategy: 'eligible_now',
          wantedStrategy: 'monitored_release_absent',
        },
        lastSearchAt: null,
        manualRequestedAt: null,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        nextSearchAfter: '2026-04-30T14:00:00.000Z',
        releaseDate: '2026-04-01',
        requestStatus: 'ready',
        researchAttemptCount: 0,
        searchAttemptCount: 0,
        searchMode: 'automatic',
        wantedStatus: 'missing',
      },
      {
        blockedReason: 'automatic_cooldown',
        evidence: {
          automaticCooldownMs: 21600000,
          cooldownDeadline: '2026-04-30T18:00:00.000Z',
          releaseDateGate: '2026-04-15T00:00:00.000Z',
          strategy: 'cooldown_gate',
          wantedStrategy: 'monitored_release_gap',
        },
        lastSearchAt: '2026-04-30T12:00:00.000Z',
        manualRequestedAt: null,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-2',
        metadataReleaseId: 'release-2',
        nextSearchAfter: '2026-04-30T18:00:00.000Z',
        releaseDate: '2026-04-15',
        requestStatus: 'cooldown',
        researchAttemptCount: 0,
        searchAttemptCount: 0,
        searchMode: 'automatic',
        wantedStatus: 'partial',
      },
      {
        blockedReason: 'release_date_pending',
        evidence: {
          automaticCooldownMs: 21600000,
          cooldownDeadline: null,
          releaseDateGate: '2026-05-15T00:00:00.000Z',
          strategy: 'release_date_gate',
          wantedStrategy: 'monitored_release_absent',
        },
        lastSearchAt: null,
        manualRequestedAt: null,
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-3',
        metadataReleaseId: 'release-3',
        nextSearchAfter: '2026-05-15T00:00:00.000Z',
        releaseDate: '2026-05-15',
        requestStatus: 'blocked',
        researchAttemptCount: 0,
        searchAttemptCount: 0,
        searchMode: 'automatic',
        wantedStatus: 'missing',
      },
    ],
  });
});

test('reconcileDiscoveryRequests preserves manual override readiness', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          blocked_reason: 'release_date_pending',
          last_search_at: '2026-04-30T10:00:00.000Z',
          manual_requested_at: '2026-04-30T13:55:00.000Z',
          metadata_artist_id: 'artist-2',
          metadata_release_group_id: 'release-group-4',
          metadata_release_id: 'release-4',
          release_date: '2026-05-15',
          search_mode: 'manual',
          wanted_status: 'missing',
          wanted_strategy: 'monitored_release_absent',
        }],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [{
      blockedReason: null,
      evidence: {
        priorBlockedReason: 'release_date_pending',
        strategy: 'manual_override',
        wantedStrategy: 'monitored_release_absent',
      },
      lastSearchAt: '2026-04-30T10:00:00.000Z',
      manualRequestedAt: '2026-04-30T13:55:00.000Z',
      metadataArtistId: 'artist-2',
      metadataReleaseGroupId: 'release-group-4',
      metadataReleaseId: 'release-4',
      nextSearchAfter: '2026-04-30T14:00:00.000Z',
      releaseDate: '2026-05-15',
      requestStatus: 'ready',
      researchAttemptCount: 0,
      searchAttemptCount: 0,
      searchMode: 'manual',
      wantedStatus: 'missing',
    }],
  });
});

test('reconcileDiscoveryRequests carries operator wanted source user from monitored rows', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-05-02T15:00:00.000Z');
  let observedSql = '';
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async (sql) => {
        observedSql = sql;
        return {
          rows: [{
            blocked_reason: null,
            last_search_at: null,
            manual_requested_at: null,
            metadata_artist_id: 'artist-6',
            metadata_release_group_id: 'release-group-6',
            metadata_release_id: 'release-6',
            release_date: '2026-05-01',
            search_mode: 'automatic',
            source_requested_for_user_id: 'user-6',
            wanted_status: 'missing',
            wanted_strategy: 'monitored_release_absent',
          }],
        };
      },
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.match(observedSql, /library_wanted_releases\.app_user_id AS source_requested_for_user_id/);
  assert.match(observedSql, /source_rows\.source_requested_for_user_id ASC NULLS LAST/);
  assert.equal(
    replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0].discoveryRequests[0].evidence.sourceRequestedForUserId,
    'user-6',
  );
});

test('reconcileDiscoveryRequests includes request-driven release matches in discovery reconciliation', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-05-02T15:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          blocked_reason: null,
          last_search_at: null,
          manual_requested_at: null,
          metadata_artist_id: 'artist-7',
          metadata_release_group_id: 'release-group-7',
          metadata_release_id: 'release-7',
          release_date: '2026-05-01',
          search_mode: 'automatic',
          source_media_request_id: 'request-7',
          source_request_kind: 'release',
          source_requested_by_user_id: 'admin-7',
          source_requested_for_user_id: 'user-7',
          wanted_status: 'missing',
          wanted_strategy: 'media_request_intake',
        }],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [{
      blockedReason: null,
      evidence: {
        automaticCooldownMs: 21600000,
        cooldownDeadline: null,
        releaseDateGate: '2026-05-01T00:00:00.000Z',
        sourceMediaRequestId: 'request-7',
        sourceRequestKind: 'release',
        sourceRequestedByUserId: 'admin-7',
        sourceRequestedForUserId: 'user-7',
        strategy: 'eligible_now',
        wantedStrategy: 'media_request_intake',
      },
      lastSearchAt: null,
      manualRequestedAt: null,
      metadataArtistId: 'artist-7',
      metadataReleaseGroupId: 'release-group-7',
      metadataReleaseId: 'release-7',
      nextSearchAfter: '2026-05-02T15:00:00.000Z',
      releaseDate: '2026-05-01',
      requestStatus: 'ready',
      researchAttemptCount: 0,
      searchAttemptCount: 0,
      searchMode: 'automatic',
      wantedStatus: 'missing',
    }],
  });
});

test('reconcileDiscoveryRequests preserves exhausted automatic discovery requests', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-05-02T15:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          blocked_reason: 'search_attempts_exhausted',
          last_search_at: '2026-05-02T10:00:00.000Z',
          manual_requested_at: null,
          metadata_artist_id: 'artist-8',
          metadata_release_group_id: 'release-group-8',
          metadata_release_id: 'release-8',
          prior_evidence: {
            searchExhausted: {
              reasonCode: 'discovery_search_attempts_exhausted',
              searchAttemptCount: 3,
            },
          },
          release_date: '2026-05-01',
          research_attempt_count: 1,
          search_attempt_count: 3,
          search_mode: 'automatic',
          wanted_status: 'missing',
          wanted_strategy: 'media_request_intake',
        }],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [{
      blockedReason: 'search_attempts_exhausted',
      evidence: {
        priorBlockedReason: 'search_attempts_exhausted',
        searchExhausted: {
          reasonCode: 'discovery_search_attempts_exhausted',
          searchAttemptCount: 3,
        },
        strategy: 'search_attempts_exhausted',
        wantedStrategy: 'media_request_intake',
      },
      lastSearchAt: '2026-05-02T10:00:00.000Z',
      manualRequestedAt: null,
      metadataArtistId: 'artist-8',
      metadataReleaseGroupId: 'release-group-8',
      metadataReleaseId: 'release-8',
      nextSearchAfter: null,
      releaseDate: '2026-05-01',
      requestStatus: 'blocked',
      researchAttemptCount: 1,
      searchAttemptCount: 3,
      searchMode: 'automatic',
      wantedStatus: 'missing',
    }],
  });
});

test('reconcileDiscoveryRequests preserves pending download recovery rediscovery', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-05-02T15:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          blocked_reason: null,
          last_search_at: '2026-05-02T10:00:00.000Z',
          manual_requested_at: null,
          metadata_artist_id: 'artist-9',
          metadata_release_group_id: 'release-group-9',
          metadata_release_id: 'release-9',
          prior_evidence: {
            downloadRecoveryRediscovery: {
              failedCandidateId: 'candidate-9',
              nextSearchAfter: '2026-05-02T17:00:00.000Z',
              researchAttemptCount: 1,
              searchAttemptCount: 1,
            },
          },
          release_date: '2026-05-01',
          research_attempt_count: 1,
          search_attempt_count: 1,
          search_mode: 'automatic',
          wanted_status: 'missing',
          wanted_strategy: 'media_request_intake',
        }],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [{
      blockedReason: null,
      evidence: {
        downloadRecoveryRediscovery: {
          failedCandidateId: 'candidate-9',
          nextSearchAfter: '2026-05-02T17:00:00.000Z',
          researchAttemptCount: 1,
          searchAttemptCount: 1,
        },
        priorBlockedReason: null,
        strategy: 'download_recovery_rediscovery',
        wantedStrategy: 'media_request_intake',
      },
      lastSearchAt: '2026-05-02T10:00:00.000Z',
      manualRequestedAt: null,
      metadataArtistId: 'artist-9',
      metadataReleaseGroupId: 'release-group-9',
      metadataReleaseId: 'release-9',
      nextSearchAfter: '2026-05-02T17:00:00.000Z',
      releaseDate: '2026-05-01',
      requestStatus: 'ready',
      researchAttemptCount: 1,
      searchAttemptCount: 1,
      searchMode: 'automatic',
      wantedStatus: 'missing',
    }],
  });
});

test('reconcileDiscoveryRequests preserves download recovery exhausted requests', async (t) => {
  const replaceLibraryDiscoveryRequests = t.mock.fn(async () => {});
  const now = new Date('2026-05-02T15:00:00.000Z');
  const service = createLibraryDiscoveryRequestService({
    getNow: () => now,
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          blocked_reason: 'download_recovery_exhausted',
          last_search_at: '2026-05-02T10:00:00.000Z',
          manual_requested_at: null,
          metadata_artist_id: 'artist-10',
          metadata_release_group_id: 'release-group-10',
          metadata_release_id: 'release-10',
          prior_evidence: {
            downloadRecoveryExhausted: {
              maxResearchAttemptCount: 2,
              researchAttemptCount: 2,
            },
          },
          release_date: '2026-05-01',
          research_attempt_count: 2,
          search_attempt_count: 1,
          search_mode: 'automatic',
          wanted_status: 'missing',
          wanted_strategy: 'media_request_intake',
        }],
      }),
    }),
    libraryDiscoveryRequestStore: {
      replaceLibraryDiscoveryRequests,
    },
  });

  await service.reconcileDiscoveryRequests();

  assert.deepEqual(replaceLibraryDiscoveryRequests.mock.calls[0].arguments[0], {
    discoveryRequests: [{
      blockedReason: 'download_recovery_exhausted',
      evidence: {
        downloadRecoveryExhausted: {
          maxResearchAttemptCount: 2,
          researchAttemptCount: 2,
        },
        priorBlockedReason: 'download_recovery_exhausted',
        strategy: 'download_recovery_exhausted',
        wantedStrategy: 'media_request_intake',
      },
      lastSearchAt: '2026-05-02T10:00:00.000Z',
      manualRequestedAt: null,
      metadataArtistId: 'artist-10',
      metadataReleaseGroupId: 'release-group-10',
      metadataReleaseId: 'release-10',
      nextSearchAfter: null,
      releaseDate: '2026-05-01',
      requestStatus: 'blocked',
      researchAttemptCount: 2,
      searchAttemptCount: 1,
      searchMode: 'automatic',
      wantedStatus: 'missing',
    }],
  });
});
