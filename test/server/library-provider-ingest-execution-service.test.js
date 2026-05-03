import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';

test('executeProviderIngestRequests applies bounded playlist policy through provider expansion service', async (t) => {
  const insertProviderIngestRequests = t.mock.fn(async ({ providerIngestRequests }) => providerIngestRequests.map((request, index) => ({ ...request, id: `derived-${index}` })));
  const updateProviderIngestRequestStatus = t.mock.fn(async (input) => input);
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const getPlaylistItems = t.mock.fn(async () => ({
    items: [{
      track: {
        album: { id: 'album-1', name: 'Album One' },
        artists: [{ id: 'artist-1', name: 'Artist One' }],
        id: 'track-1',
        type: 'track',
      },
    }],
    next: null,
  }));

  const service = createLibraryProviderIngestExecutionService({
    mediaRequestStore: { mergeMediaRequestEvidence },
    providerIngestRequestStore: {
      insertProviderIngestRequests,
      listPlannedProviderIngestRequests: async () => [{
        canonicalUrl: 'https://open.spotify.com/playlist/playlist-1',
        id: 'row-1',
        ingestTargetType: 'playlist_page',
        pageCursor: null,
        pageNumber: 1,
        sourceIdentifier: 'playlist-1',
        sourceProvider: 'spotify',
      }],
      updateProviderIngestRequestStatus,
    },
    recordAuditEventFn,
    resolveProviderClients: async () => ({
      settings: { playlistExpansionPolicy: 'bounded' },
      spotify: { getPlaylistItems },
    }),
  });

  const result = await service.executeProviderIngestRequests({ mediaRequestId: 'request-1', operationRunId: 'run-1' });

  assert.equal(result.executedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(insertProviderIngestRequests.mock.calls[0].arguments[0].providerIngestRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier]), [
    ['release', 'album-1'],
  ]);
  assert.equal(updateProviderIngestRequestStatus.mock.calls[0].arguments[0].status, 'completed');
  assert.equal(mergeMediaRequestEvidence.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('executeProviderIngestRequests expands playlist artists when policy opts into artist discovery', async (t) => {
  const insertProviderIngestRequests = t.mock.fn(async ({ providerIngestRequests }) => providerIngestRequests);

  const service = createLibraryProviderIngestExecutionService({
    mediaRequestStore: { mergeMediaRequestEvidence: async () => {} },
    providerIngestRequestStore: {
      insertProviderIngestRequests,
      listPlannedProviderIngestRequests: async () => [{
        canonicalUrl: 'https://open.spotify.com/playlist/playlist-1',
        id: 'row-1',
        ingestTargetType: 'playlist_page',
        pageCursor: null,
        pageNumber: 1,
        sourceIdentifier: 'playlist-1',
        sourceProvider: 'spotify',
      }],
      updateProviderIngestRequestStatus: async (input) => input,
    },
    recordAuditEventFn: async () => {},
    resolveProviderClients: async () => ({
      settings: { playlistExpansionPolicy: 'artist_discovery' },
      spotify: {
        getPlaylistItems: async () => ({
          items: [{
            track: {
              album: {
                artists: [{ id: 'artist-1', name: 'Artist One' }],
                id: 'album-1',
                name: 'Album One',
              },
              id: 'track-1',
              type: 'track',
            },
          }],
          next: null,
        }),
      },
    }),
  });

  await service.executeProviderIngestRequests({ mediaRequestId: 'request-1' });

  assert.deepEqual(insertProviderIngestRequests.mock.calls[0].arguments[0].providerIngestRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier]), [
    ['release', 'album-1'],
    ['artist', 'artist-1'],
  ]);
});

test('queueExternalMediaRequestExecution rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createLibraryProviderIngestExecutionService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library provider ingest execution');
    },
  });

  await assert.rejects(
    () => service.queueExternalMediaRequestExecution({
      mediaRequestId: 'request-7',
      canonicalUrl: 'https://open.spotify.com/playlist/pl-7',
      resourceType: 'playlist',
      sourceIdentifier: 'pl-7',
      sourceProvider: 'spotify',
    }),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
