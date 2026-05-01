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
      searchMode: 'manual',
      wantedStatus: 'missing',
    }],
  });
});