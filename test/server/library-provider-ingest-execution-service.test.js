import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';

test('tracked collection execution uses bounded atomic batches instead of legacy provider expansion', async (t) => {
  const result = { executedCount: 10, failedCount: 0, collection: { status: 'preparing' } };
  const executeCollection = t.mock.fn(async () => result);
  const listPlannedProviderIngestRequests = t.mock.fn(async () => assert.fail('Tracked collections must use their durable batch'));
  const service = createLibraryProviderIngestExecutionService({
    collectionIntakeService: { getCollection: async () => ({ mediaRequestId: 'request' }), executeCollection },
    providerIngestRequestStore: { listPlannedProviderIngestRequests },
  });
  assert.equal(await service.executeProviderIngestRequests({ mediaRequestId: 'request', operationRunId: 'run' }), result);
  assert.equal(executeCollection.mock.calls[0].arguments[0].operationRunId, 'run');
  assert.equal(listPlannedProviderIngestRequests.mock.callCount(), 0);
});

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
    getActiveExternalRequest: async () => ({ id: 'request-1', requestState: 'needs_fetch' }),
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
    getActiveExternalRequest: async () => ({ id: 'request-1', requestState: 'needs_fetch' }),
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

function createCancellationFixture(t, { cancelAfter = null, initialState = 'needs_fetch' } = {}) {
  let requestState = initialState;
  const getAlbum = t.mock.fn(async () => {
    if (cancelAfter === 'provider') requestState = 'cancelled';
    return { id: 'album-1' };
  });
  const updateProviderIngestRequestStatus = t.mock.fn(async () => {
    if (cancelAfter === 'first_row') requestState = 'cancelled';
  });
  const mergeMediaRequestEvidence = t.mock.fn(async () => {});
  const insertProviderIngestRequests = t.mock.fn(async () => []);
  const resolveProviderClients = t.mock.fn(async () => ({ spotify: { getAlbum } }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const createOperationRun = t.mock.fn(async () => ({ id: 'run-1' }));
  const service = createLibraryProviderIngestExecutionService({
    executionRunStore: {
      getActiveRunByMediaRequestId: async () => {
        if (cancelAfter === 'run_lookup') requestState = 'cancelled';
        return null;
      },
      createOperationRun,
    },
    mediaRequestStore: {
      getMediaRequestById: async () => requestState === 'missing' ? null : ({
        id: 'child-1',
        requestKind: 'external_url',
        requestState,
        sourceUrl: 'https://open.spotify.com/album/album-1',
      }),
      mergeMediaRequestEvidence,
    },
    providerIngestRequestStore: {
      insertProviderIngestRequests,
      listPlannedProviderIngestRequests: async () => ['row-1', 'row-2'].map((id) => ({
        id,
        ingestTargetType: 'release',
        sourceIdentifier: 'album-1',
        sourceProvider: 'spotify',
      })),
      updateProviderIngestRequestStatus,
    },
    recordAuditEventFn,
    resolveProviderClients,
  });
  return { service, createOperationRun, getAlbum, insertProviderIngestRequests, mergeMediaRequestEvidence, recordAuditEventFn, resolveProviderClients, updateProviderIngestRequestStatus };
}

test('cancelled external requests never resolve clients or start provider calls', async (t) => {
  const fixture = createCancellationFixture(t, { initialState: 'cancelled' });
  await assert.rejects(fixture.service.executeProviderIngestRequests({ mediaRequestId: 'child-1', operationRunId: 'run-1' }), {
    code: 'operation_run_cancelled',
    runId: 'run-1',
  });
  assert.equal(fixture.resolveProviderClients.mock.callCount(), 0);
  assert.equal(fixture.getAlbum.mock.callCount(), 0);
});

test('provider execution fails safely for a missing request', async (t) => {
  const fixture = createCancellationFixture(t, { initialState: 'missing' });
  await assert.rejects(fixture.service.executeProviderIngestRequests({ mediaRequestId: 'child-1' }), { code: 'media_request_not_found' });
  assert.equal(fixture.resolveProviderClients.mock.callCount(), 0);
});

for (const cancelAfter of ['provider', 'first_row']) {
  test(`provider execution stops after cancellation at ${cancelAfter} without reporting completion`, async (t) => {
    const fixture = createCancellationFixture(t, { cancelAfter });
    await assert.rejects(fixture.service.executeProviderIngestRequests({ mediaRequestId: 'child-1' }), { code: 'operation_run_cancelled' });
    assert.equal(fixture.getAlbum.mock.callCount(), 1);
    assert.equal(fixture.updateProviderIngestRequestStatus.mock.callCount(), cancelAfter === 'first_row' ? 1 : 0);
    assert.equal(fixture.insertProviderIngestRequests.mock.callCount(), 0);
    assert.equal(fixture.mergeMediaRequestEvidence.mock.callCount(), 0);
    assert.equal(fixture.recordAuditEventFn.mock.callCount(), 0);
  });
}

for (const options of [{ initialState: 'cancelled' }, { cancelAfter: 'run_lookup' }]) {
  test(`execution queue checks current request state before creating a job: ${JSON.stringify(options)}`, async (t) => {
    const fixture = createCancellationFixture(t, options);
    await assert.rejects(fixture.service.queueExternalMediaRequestExecution({ mediaRequestId: 'child-1' }), { code: 'operation_run_cancelled' });
    assert.equal(fixture.createOperationRun.mock.callCount(), 0);
  });
}
