import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';

test('createLibraryMediaRequestService marks matched local releases as already existing media', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-1',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    existingMatch: {
      artistName: 'Daft Punk',
      releaseGroupId: 'release-group-1',
      releaseGroupTitle: 'Discovery',
      releaseId: 'release-1',
      releaseTitle: 'Discovery',
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      getMediaRequestCounts: async () => ({ alreadyExists: 1, needsFetch: 0, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => [],
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({
        results: [{
          artistName: 'Daft Punk',
          id: 'release-1',
          releaseGroupId: 'release-group-1',
          title: 'Discovery',
        }],
      })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: t.mock.fn(async () => ({
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        reconciliationStatus: 'complete',
      })),
    },
    recordAuditEventFn,
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
    },
    requestMetadata: {
      ipAddress: '198.51.100.10',
      userAgent: 'HarmoniarrMediaRequestTest/1.0',
    },
  });

  assert.equal(createMediaRequest.mock.callCount(), 1);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestState, 'already_exists');
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].matchedMetadataReleaseId, 'release-1');
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(mediaRequest.requestState, 'already_exists');
});

test('createLibraryMediaRequestService keeps matched releases in needs_fetch when the library is incomplete', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-3',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    existingMatch: {
      artistName: 'Daft Punk',
      releaseGroupId: payload.matchedMetadataReleaseGroupId,
      releaseTitle: 'Discovery',
    },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => [],
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({
        results: [{
          artistName: 'Daft Punk',
          id: 'release-1',
          releaseGroupId: 'release-group-1',
          title: 'Discovery',
        }],
      })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: t.mock.fn(async () => ({
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        reconciliationStatus: 'missing',
      })),
    },
    recordAuditEventFn: async () => {},
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-3',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.callCount(), 1);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestState, 'needs_fetch');
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].matchedMetadataReleaseId, 'release-1');
  assert.equal(mediaRequest.requestState, 'needs_fetch');
});

test('createLibraryMediaRequestService classifies supported external URLs as fetchable requests', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-2',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    sourceProvider: payload.sourceProvider,
    sourceUrl: payload.sourceUrl,
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => [],
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-2',
    payload: {
      requestKind: 'external_url',
      sourceUrl: 'https://open.spotify.com/playlist/12345',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestState, 'needs_fetch');
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].sourceProvider, 'spotify');
  assert.equal(mediaRequest.requestState, 'needs_fetch');
});

test('createLibraryMediaRequestService rejects invalid request payloads before persistence', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest: async () => {
        throw new Error('Should not be called');
      },
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => [],
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.createMediaRequest({
      actorUserId: 'user-1',
      payload: { requestKind: 'release', artistName: 'Daft Punk' },
    }),
    (error) => error?.code === 'validation_error',
  );
});

test('createLibraryMediaRequestService preserves lock conflicts from external intake planning', async () => {
  const service = createLibraryMediaRequestService({
    externalIntakeService: {
      queueExternalMediaRequestPlanning: async () => {
        throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library external intake planning');
      },
    },
    mediaRequestStore: {
      createMediaRequest: async () => ({
        id: 'request-9',
        requestKind: 'external_url',
        requestState: 'needs_fetch',
        sourceUrl: 'https://open.spotify.com/playlist/12345',
      }),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => [],
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.createMediaRequest({
      actorUserId: 'user-9',
      payload: {
        requestKind: 'external_url',
        sourceUrl: 'https://open.spotify.com/playlist/12345',
      },
    }),
    (error) => error.code === 'recovery_lock_conflict',
  );
});