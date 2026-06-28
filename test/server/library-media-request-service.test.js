import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryMediaRequestFulfillmentService } from '../../src/server/library/library-media-request-fulfillment-service.js';
import { createLibraryMediaRequestNotificationService } from '../../src/server/library/library-media-request-notification-service.js';
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';

test('createLibraryMediaRequestService marks matched local releases as already existing media', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-1',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
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
      listMediaRequests: async () => ({ mediaRequests: [] }),
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

test('createLibraryMediaRequestService falls back to structured artist and release matching for local metadata', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-structured-match',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
    existingMatch: {
      artistName: 'Autechre',
      releaseGroupId: payload.matchedMetadataReleaseGroupId,
      releaseGroupTitle: 'Amber',
      releaseId: payload.matchedMetadataReleaseId,
      releaseTitle: 'Amber',
    },
  }));
  const searchReleases = t.mock.fn(async ({ query, limit }) => {
    assert.equal(query, 'Autechre Amber');
    assert.equal(limit, 5);
    return { results: [] };
  });
  const searchReleasesByArtistAndTitle = t.mock.fn(async ({ artistName, releaseTitle, limit }) => {
    assert.equal(artistName, 'Autechre');
    assert.equal(releaseTitle, 'Amber');
    assert.equal(limit, 5);
    return {
      results: [{
        artistName: 'Autechre',
        id: 'release-amber',
        releaseGroupId: 'release-group-amber',
        title: 'Amber',
      }],
    };
  });

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 1, needsFetch: 0, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases,
      searchReleasesByArtistAndTitle,
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: t.mock.fn(async () => ({
        metadataArtistId: 'artist-autechre',
        metadataReleaseGroupId: 'release-group-amber',
        metadataReleaseId: 'release-amber',
        reconciliationStatus: 'complete',
      })),
    },
    recordAuditEventFn: async () => {},
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Autechre',
      releaseTitle: 'Amber',
      requestKind: 'release',
    },
  });

  const storedRequest = createMediaRequest.mock.calls[0].arguments[0];
  assert.equal(searchReleases.mock.callCount(), 1);
  assert.equal(searchReleasesByArtistAndTitle.mock.callCount(), 1);
  assert.equal(storedRequest.requestState, 'already_exists');
  assert.equal(storedRequest.matchedMetadataReleaseId, 'release-amber');
  assert.equal(storedRequest.evidence.localReleaseMatchStrategy, 'structured_artist_title');
  assert.equal(storedRequest.evidence.localReleaseResultCount, 0);
  assert.equal(storedRequest.evidence.structuredLocalReleaseResultCount, 1);
  assert.equal(mediaRequest.requestState, 'already_exists');
});

test('createLibraryMediaRequestService does not run structured lookup after combined search matches', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-combined-match',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
    existingMatch: null,
  }));
  const searchReleasesByArtistAndTitle = t.mock.fn(async () => {
    throw new Error('structured lookup should not be called');
  });

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 1, needsFetch: 0, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
      searchReleasesByArtistAndTitle,
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => ({
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        reconciliationStatus: 'complete',
      }),
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
    },
  });

  assert.equal(searchReleasesByArtistAndTitle.mock.callCount(), 0);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].evidence.localReleaseMatchStrategy, 'combined_query');
});

test('createLibraryMediaRequestService keeps matched releases in needs_fetch when the library is incomplete', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-3',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
    existingMatch: {
      artistName: 'Daft Punk',
      releaseGroupId: payload.matchedMetadataReleaseGroupId,
      releaseTitle: 'Discovery',
    },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
    sourceProvider: payload.sourceProvider,
    sourceUrl: payload.sourceUrl,
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
      listMediaRequests: async () => ({ mediaRequests: [] }),
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

test('createLibraryMediaRequestService creates fan-out child requests when requestedForUserIds has multiple targets', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: `request-${createMediaRequest.mock.callCount() + 1}`,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'admin', role: 'admin' },
    requestedForUser: { id: payload.requestedForUserId, username: `user-${payload.requestedForUserId}`, role: 'requester' },
    existingMatch: null,
    artistName: payload.artistName,
    releaseTitle: payload.releaseTitle,
    linkedRequestId: null,
    fanOutParentId: payload.fanOutParentId ?? null,
    fanOutChildCount: payload.fanOutChildCount ?? 0,
  }));

  const createFanOutChildRequests = t.mock.fn(async ({ parentRequest, targetUserIds }) => {
    return targetUserIds.map((targetUserId, idx) => ({
      id: `child-${idx + 1}`,
      requestKind: parentRequest.requestKind,
      requestState: parentRequest.requestState,
      requestedByUser: parentRequest.requestedByUser,
      requestedForUser: { id: targetUserId, username: `user-${targetUserId}`, role: 'requester' },
      existingMatch: null,
      fanOutParentId: parentRequest.id,
      fanOutChildCount: 0,
    }));
  });

  const updateFanOutChildCount = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const recordActivityEventFn = t.mock.fn(async () => {});

  const getAppUserById = t.mock.fn(async ({ userId }) => {
    const users = {
      'admin-1': { id: 'admin-1', username: 'admin', role: 'admin', isDisabled: false, plexProfile: null },
      'user-1': { id: 'user-1', username: 'listener1', role: 'requester', isDisabled: false, plexProfile: null },
      'user-2': { id: 'user-2', username: 'listener2', role: 'requester', isDisabled: false, plexProfile: null },
      'user-3': { id: 'user-3', username: 'listener3', role: 'requester', isDisabled: false, plexProfile: null },
    };
    return users[userId] ?? null;
  });

  const service = createLibraryMediaRequestService({
    getAppUserById,
    mediaRequestStore: {
      createMediaRequest,
      createFanOutChildRequests,
      updateFanOutChildCount,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({ results: [] })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordActivityEventFn,
    recordAuditEventFn,
  });

  const result = await service.createMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserIds: ['user-1', 'user-2', 'user-3'],
    },
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'Test/1.0' },
  });

  assert.equal(createMediaRequest.mock.callCount(), 1);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestedForUserId, 'user-1');
  assert.equal(createFanOutChildRequests.mock.callCount(), 1);
  assert.deepEqual(
    createFanOutChildRequests.mock.calls[0].arguments[0].targetUserIds,
    ['user-2', 'user-3'],
  );
  assert.equal(updateFanOutChildCount.mock.callCount(), 1);
  assert.equal(result.fanOut.childCount, 2);
  assert.equal(result.fanOut.totalTargets, 3);
  assert.equal(result.fanOut.ineligible.length, 0);
  assert.ok(recordAuditEventFn.mock.callCount() >= 2);
});

test('createLibraryMediaRequestService fan-out skips ineligible targets', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'parent-1',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'admin', role: 'admin' },
    requestedForUser: { id: payload.requestedForUserId, username: 'eligible', role: 'requester' },
    existingMatch: null,
    artistName: payload.artistName,
    releaseTitle: payload.releaseTitle,
    linkedRequestId: null,
    fanOutParentId: null,
    fanOutChildCount: 0,
  }));

  const createFanOutChildRequests = t.mock.fn(async () => [
    { id: 'child-1', fanOutParentId: 'parent-1', fanOutChildCount: 0 },
  ]);
  const updateFanOutChildCount = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const getAppUserById = t.mock.fn(async ({ userId }) => {
    if (userId === 'admin-1') return { id: 'admin-1', username: 'admin', role: 'admin', isDisabled: false, plexProfile: null };
    if (userId === 'eligible-1') return { id: 'eligible-1', username: 'eligible', role: 'requester', isDisabled: false, plexProfile: null };
    if (userId === 'disabled-1') return { id: 'disabled-1', username: 'disabled', role: 'requester', isDisabled: true, plexProfile: null };
    return null;
  });

  const service = createLibraryMediaRequestService({
    getAppUserById,
    mediaRequestStore: {
      createMediaRequest,
      createFanOutChildRequests,
      updateFanOutChildCount,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({ results: [] })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn,
  });

  const result = await service.createMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserIds: ['eligible-1', 'disabled-1'],
    },
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'Test/1.0' },
  });

  assert.equal(result.fanOut.ineligible.length, 1);
  assert.equal(result.fanOut.ineligible[0].reasonCode, 'media_request_target_disabled');
  assert.equal(result.fanOut.totalTargets, 1);
});

test('createLibraryMediaRequestService fan-out with single target falls through to single-request path', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-1',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'admin', role: 'admin' },
    requestedForUser: { id: payload.requestedForUserId, username: 'target', role: 'requester' },
    existingMatch: null,
    artistName: payload.artistName,
    releaseTitle: payload.releaseTitle,
    linkedRequestId: null,
  }));

  const createFanOutChildRequests = t.mock.fn(async () => []);
  const recordAuditEventFn = t.mock.fn(async () => {});

  const getAppUserById = t.mock.fn(async ({ userId }) => {
    if (userId === 'admin-1') return { id: 'admin-1', username: 'admin', role: 'admin', isDisabled: false, plexProfile: null };
    if (userId === 'user-1') return { id: 'user-1', username: 'target', role: 'requester', isDisabled: false, plexProfile: null };
    return null;
  });

  const service = createLibraryMediaRequestService({
    getAppUserById,
    mediaRequestStore: {
      createMediaRequest,
      createFanOutChildRequests,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({ results: [] })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn,
  });

  const result = await service.createMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
      requestedForUserIds: ['user-1'],
    },
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'Test/1.0' },
  });

  assert.equal(createMediaRequest.mock.callCount(), 1);
  assert.equal(createFanOutChildRequests.mock.callCount(), 0);
  assert.equal(result.linked, false);
});

test('createLibraryMediaRequestService fan-out rejects non-admin multi-target requests', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest: async () => { throw new Error('should not be called'); },
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
    service.createMediaRequest({
      actorUserId: 'user-1',
      actorUserRole: 'requester',
      payload: {
        artistName: 'Daft Punk',
        releaseTitle: 'Discovery',
        requestKind: 'release',
        requestedForUserIds: ['user-1', 'user-2'],
      },
      requestMetadata: {},
    }),
    (error) => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('createLibraryMediaRequestService fan-out rejects when all targets are ineligible', async (t) => {
  const createMediaRequest = t.mock.fn(async () => { throw new Error('should not be called'); });
  const getAppUserById = t.mock.fn(async ({ userId }) => ({
    id: userId,
    username: `disabled-${userId}`,
    role: 'requester',
    isDisabled: true,
    plexProfile: null,
  }));

  const service = createLibraryMediaRequestService({
    getAppUserById,
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: t.mock.fn(async () => ({ results: [] })),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    service.createMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      payload: {
        artistName: 'Daft Punk',
        releaseTitle: 'Discovery',
        requestKind: 'release',
        requestedForUserIds: ['disabled-1', 'disabled-2'],
      },
      requestMetadata: {},
    }),
    (error) => error?.status === 409 && error?.code === 'media_request_no_eligible_targets',
  );
});

test('createLibraryMediaRequestService fan-out validates requestedForUserIds array length', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest: async () => { throw new Error('should not be called'); },
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  const ids = Array.from({ length: 51 }, (_, i) => `user-${i + 1}`);
  await assert.rejects(
    service.createMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      payload: {
        artistName: 'Daft Punk',
        releaseTitle: 'Discovery',
        requestKind: 'release',
        requestedForUserIds: ids,
      },
      requestMetadata: {},
    }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
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
      listMediaRequests: async () => ({ mediaRequests: [] }),
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

test('buildMediaRequestSummary exposes fulfillment counts and recent request statuses', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestFulfillmentService: createLibraryMediaRequestFulfillmentService({
      listImportCandidatesBySourceMediaRequestIds: async () => ([
        {
          id: 'candidate-1',
          normalizedPayload: {
            requestOwnership: {
              sourceMediaRequestId: 'request-2',
            },
          },
          status: 'downloading',
          updatedAt: '2026-05-04T11:00:00.000Z',
        },
      ]),
    }),
    mediaRequestStore: {
      createMediaRequest: async () => {
        throw new Error('Should not be called');
      },
      getMediaRequestCounts: async () => ({ alreadyExists: 1, needsFetch: 1, needsReview: 1, totalRequests: 3 }),
      countMediaRequests: async () => 3,
      listMediaRequests: async () => ({
        mediaRequests: [
          {
            id: 'request-1',
            requestedByUser: {
              id: 'admin-1',
              username: 'owner',
            },
            requestedForUser: {
              id: 'user-7',
              username: 'listener',
            },
            requestState: 'already_exists',
            updatedAt: '2026-05-04T10:00:00.000Z',
          },
          {
            id: 'request-2',
            requestedByUser: {
              id: 'admin-1',
              username: 'owner',
            },
            requestedForUser: {
              id: 'user-7',
              username: 'listener',
            },
            requestState: 'needs_fetch',
            updatedAt: '2026-05-04T11:00:00.000Z',
          },
          {
            id: 'request-3',
            requestedByUser: {
              id: 'user-7',
              username: 'listener',
            },
            requestedForUser: {
              id: 'user-7',
              username: 'listener',
            },
            requestState: 'needs_review',
            updatedAt: '2026-05-04T12:00:00.000Z',
          },
        ],
      }),
    },
    mediaRequestNotificationService: createLibraryMediaRequestNotificationService({
      nowFn: () => new Date('2026-05-04T12:30:00.000Z'),
    }),
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  const summary = await service.buildMediaRequestSummary({ requestedForUserId: 'user-7' });

  assert.deepEqual(summary.fulfillmentCounts, {
    active: 1,
    alreadyAvailable: 1,
    downloading: 1,
    failed: 0,
    fulfilled: 0,
    importPending: 0,
    queued: 0,
    satisfied: 1,
    totalRequests: 3,
    underReview: 1,
  });
  assert.equal(summary.summary.status, 'active');
  assert.equal(summary.notificationFeed.checkedAt, '2026-05-04T12:30:00.000Z');
  assert.equal(summary.notificationFeed.counts.total, 5);
  assert.equal(summary.notificationFeed.counts.byCategory.delegated_request, 2);
  assert.equal(summary.notificationFeed.notifications[0].title, 'Request under review');
  assert.equal(summary.recentRequests[0].fulfillmentStatus.code, 'already_available');
  assert.equal(summary.recentRequests[1].fulfillmentStatus.code, 'downloading');
  assert.equal(summary.recentRequests[2].fulfillmentStatus.code, 'under_review');
});

test('createLibraryMediaRequestService allows admins to create delegated requests for eligible users', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-10',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'admin', role: 'admin' },
    requestedForUser: { id: payload.requestedForUserId, username: 'plex-user', role: 'requester' },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryMediaRequestService({
    getAppUserById: t.mock.fn(async () => ({
      id: 'user-plex-4',
      isDisabled: false,
      plexProfile: {
        accessPolicy: {
          needsOperatorReview: false,
          reasonCode: 'plex_shared_library_access',
          requestTargetingEligible: true,
        },
      },
    })),
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: async () => null,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn,
  });

  await service.createMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    payload: {
      artistName: 'Burial',
      releaseTitle: 'Untrue',
      requestKind: 'release',
      requestedForUserId: 'user-plex-4',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestedByUserId, 'admin-1');
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].requestedForUserId, 'user-plex-4');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].details.delegated, true);
});

test('createLibraryMediaRequestService rejects delegated targets for non-admin users', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest: async () => {
        throw new Error('Should not be called');
      },
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
      actorUserId: 'user-2',
      actorUserRole: 'requester',
      payload: {
        artistName: 'Massive Attack',
        releaseTitle: 'Mezzanine',
        requestKind: 'release',
        requestedForUserId: 'user-3',
      },
    }),
    (error) => error?.code === 'forbidden',
  );
});

test('createLibraryMediaRequestService rejects delegated targets that still require Plex access review', async () => {
  const service = createLibraryMediaRequestService({
    getAppUserById: async () => ({
      id: 'user-plex-9',
      isDisabled: false,
      plexProfile: {
        accessPolicy: {
          needsOperatorReview: true,
          reasonCode: 'plex_member_access_unconfirmed',
          requestTargetingEligible: false,
        },
      },
    }),
    mediaRequestStore: {
      createMediaRequest: async () => {
        throw new Error('Should not be called');
      },
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
      actorUserId: 'admin-3',
      actorUserRole: 'admin',
      payload: {
        artistName: 'Aphex Twin',
        releaseTitle: 'Selected Ambient Works 85-92',
        requestKind: 'release',
        requestedForUserId: 'user-plex-9',
      },
    }),
    (error) => error?.code === 'media_request_target_ineligible',
  );
});

test('createLibraryMediaRequestService links duplicate requests to existing primary by MBID', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-linked',
    linkedRequestId: payload.linkedRequestId,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener-2', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener-2', role: 'requester' },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => ({
        id: 'request-primary',
        musicbrainzReleaseId: 'mbid-discovery',
        requestedForUser: { id: 'user-A' },
        requestState: 'needs_fetch',
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn,
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-B',
    payload: {
      artistName: 'Daft Punk',
      musicbrainzReleaseId: 'mbid-discovery',
      releaseTitle: 'Discovery',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].linkedRequestId, 'request-primary');
  assert.equal(mediaRequest.linked, true);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].details.linked, true);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].details.linkedToRequestId, 'request-primary');
});

test('createLibraryMediaRequestService links duplicate requests by text match when no MBID', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-linked-text',
    linkedRequestId: payload.linkedRequestId,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener-3', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener-3', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async ({ musicbrainzReleaseId, artistName, releaseTitle }) => {
        if (!musicbrainzReleaseId && artistName && releaseTitle) {
          return {
            id: 'request-primary-text',
            requestedForUser: { id: 'user-A' },
            requestState: 'needs_fetch',
          };
        }
        return null;
      }),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
    actorUserId: 'user-C',
    payload: {
      artistName: 'Burial',
      releaseTitle: 'Untrue',
      requestKind: 'release',
    },
  });

  assert.equal(mediaRequest.linked, true);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].linkedRequestId, 'request-primary-text');
});

test('createLibraryMediaRequestService does not dedup already_exists requests', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-no-dedup',
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const findActiveDuplicateRequest = t.mock.fn(async () => null);
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest,
      getMediaRequestCounts: async () => ({ alreadyExists: 1, needsFetch: 0, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
        metadataReleaseGroupId: 'release-group-1',
        metadataReleaseId: 'release-1',
        reconciliationStatus: 'complete',
      })),
    },
    recordAuditEventFn: async () => {},
  });

  const mediaRequest = await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Daft Punk',
      releaseTitle: 'Discovery',
      requestKind: 'release',
    },
  });

  assert.equal(mediaRequest.linked, false);
  assert.equal(findActiveDuplicateRequest.mock.callCount(), 0);
});

test('createLibraryMediaRequestService creates unlinked request when no duplicate exists', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-solo',
    linkedRequestId: payload.linkedRequestId,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
    actorUserId: 'user-1',
    payload: {
      artistName: 'Boards of Canada',
      releaseTitle: 'Music Has the Right to Children',
      requestKind: 'release',
    },
  });

  assert.equal(mediaRequest.linked, false);
  assert.equal(createMediaRequest.mock.calls[0].arguments[0].linkedRequestId, null);
});

test('createLibraryMediaRequestService stores musicbrainzReleaseId on request creation', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-mbid',
    musicbrainzReleaseId: payload.musicbrainzReleaseId,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Radiohead',
      musicbrainzReleaseId: 'mbid-ok-computer',
      releaseTitle: 'OK Computer',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].musicbrainzReleaseId, 'mbid-ok-computer');
});

test('createLibraryMediaRequestService records dedup evidence in request evidence', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-evidence',
    evidence: payload.evidence,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => ({
        id: 'request-primary',
        musicbrainzReleaseId: 'mbid-x',
        requestedForUser: { id: 'user-A' },
        requestState: 'needs_fetch',
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-B',
    payload: {
      artistName: 'Aphex Twin',
      musicbrainzReleaseId: 'mbid-x',
      releaseTitle: 'Selected Ambient Works',
      requestKind: 'release',
    },
  });

  const evidence = createMediaRequest.mock.calls[0].arguments[0].evidence;
  assert.equal(evidence.dedupLinkedToRequestId, 'request-primary');
  assert.equal(evidence.dedupMatchMethod, 'musicbrainz_release_id');
});

test('createLibraryMediaRequestService stores expectedReleaseDate for pre-requests', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-prerequest',
    expectedReleaseDate: payload.expectedReleaseDate,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Radiohead',
      expectedReleaseDate: '2099-12-01',
      releaseTitle: 'Future Album',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].expectedReleaseDate, '2099-12-01');
});

test('createLibraryMediaRequestService normalizes partial expectedReleaseDate values', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-prerequest',
    expectedReleaseDate: payload.expectedReleaseDate,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Radiohead',
      expectedReleaseDate: '2000',
      releaseTitle: 'Kid A',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].expectedReleaseDate, '2000-01-01');
});

test('createLibraryMediaRequestService passes null expectedReleaseDate when not provided', async (t) => {
  const createMediaRequest = t.mock.fn(async (payload) => ({
    id: 'request-no-date',
    expectedReleaseDate: payload.expectedReleaseDate,
    requestKind: payload.requestKind,
    requestState: payload.requestState,
    requestedByUser: { id: payload.requestedByUserId, username: 'listener', role: 'requester' },
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest,
      findActiveDuplicateRequest: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    metadataSearchService: {
      searchReleases: async () => ({ results: [] }),
    },
    releaseAvailabilityStore: {
      getReleaseAvailability: async () => null,
    },
    recordAuditEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      artistName: 'Portishead',
      releaseTitle: 'Third',
      requestKind: 'release',
    },
  });

  assert.equal(createMediaRequest.mock.calls[0].arguments[0].expectedReleaseDate, null);
});

test('createLibraryMediaRequestService rejects malformed expectedReleaseDate', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      createMediaRequest: async () => {
        throw new Error('Should not be called');
      },
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
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
      payload: {
        artistName: 'Boards of Canada',
        expectedReleaseDate: 'not-a-date',
        releaseTitle: 'Geogaddi',
        requestKind: 'release',
      },
    }),
    (error) => error?.code === 'validation_error',
  );
});

test('reassignMediaRequest rejects non-admin callers', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.reassignMediaRequest({
      actorUserId: 'user-1',
      actorUserRole: 'requester',
      mediaRequestId: 'request-1',
      newRequestedForUserId: 'user-2',
    }),
    (error) => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('reassignMediaRequest rejects unknown media request ids', async (t) => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: t.mock.fn(async () => null),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.reassignMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      mediaRequestId: 'nonexistent-request',
      newRequestedForUserId: 'user-2',
    }),
    (error) => error?.status === 404 && error?.code === 'media_request_not_found',
  );
});

test('reassignMediaRequest rejects reassignment to the same user', async (t) => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: t.mock.fn(async () => ({
        id: 'request-1',
        requestedForUser: { id: 'user-2', role: 'requester', username: 'same-user' },
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.reassignMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      mediaRequestId: 'request-1',
      newRequestedForUserId: 'user-2',
    }),
    (error) => error?.status === 409 && error?.code === 'reassignment_noop',
  );
});

test('reassignMediaRequest rejects ineligible target users', async (t) => {
  const service = createLibraryMediaRequestService({
    getAppUserById: t.mock.fn(async () => ({
      id: 'user-ineligible',
      isDisabled: true,
      role: 'requester',
      username: 'disabled-user',
    })),
    mediaRequestStore: {
      getMediaRequestById: t.mock.fn(async () => ({
        id: 'request-1',
        requestedForUser: { id: 'user-old', role: 'requester', username: 'old-user' },
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.reassignMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      mediaRequestId: 'request-1',
      newRequestedForUserId: 'user-ineligible',
    }),
    (error) => error?.status === 409 && error?.code === 'media_request_target_ineligible',
  );
});

test('reassignMediaRequest updates ownership and records both domain event and audit event', async (t) => {
  const updateRequestedForUserId = t.mock.fn(async () => true);
  const insertMediaRequestEvent = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const recordActivityEventFn = t.mock.fn(async () => {});

  const service = createLibraryMediaRequestService({
    getAppUserById: t.mock.fn(async () => ({
      id: 'user-new',
      username: 'new-target',
      disabled: false,
      role: 'requester',
    })),
    mediaRequestStore: {
      getMediaRequestById: t.mock.fn(async () => ({
        artistName: 'Aphex Twin',
        id: 'request-1',
        releaseTitle: 'Selected Ambient Works 85-92',
        requestKind: 'release',
        requestedForUser: { id: 'user-old', role: 'requester', username: 'old-target' },
        requestState: 'needs_fetch',
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      insertMediaRequestEvent,
      listMediaRequests: async () => ({ mediaRequests: [] }),
      updateRequestedForUserId,
    },
    recordActivityEventFn,
    recordAuditEventFn,
  });

  const _result = await service.reassignMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequestId: 'request-1',
    newRequestedForUserId: 'user-new',
    reason: 'User account transfer',
    requestMetadata: { ipAddress: '10.0.0.1', userAgent: 'TestAgent/1.0' },
  });

  assert.equal(updateRequestedForUserId.mock.callCount(), 1);
  assert.deepEqual(updateRequestedForUserId.mock.calls[0].arguments[0], {
    mediaRequestId: 'request-1',
    newRequestedForUserId: 'user-new',
  });

  assert.equal(insertMediaRequestEvent.mock.callCount(), 1);
  const eventArgs = insertMediaRequestEvent.mock.calls[0].arguments[0];
  assert.equal(eventArgs.mediaRequestId, 'request-1');
  assert.equal(eventArgs.eventType, 'reassigned');
  assert.equal(eventArgs.previousRequestedForUserId, 'user-old');
  assert.equal(eventArgs.newRequestedForUserId, 'user-new');
  assert.equal(eventArgs.reason, 'User account transfer');
  assert.equal(eventArgs.actorUserId, 'admin-1');

  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  const auditArgs = recordAuditEventFn.mock.calls[0].arguments[0];
  assert.equal(auditArgs.eventType, 'media_request_reassigned');
  assert.equal(auditArgs.entityId, 'request-1');
  assert.equal(auditArgs.ipAddress, '10.0.0.1');

  assert.equal(recordActivityEventFn.mock.callCount(), 1);
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].eventType, 'request_reassigned');
});

test('reassignMediaRequest works without a reason', async (t) => {
  const updateRequestedForUserId = t.mock.fn(async () => true);
  const insertMediaRequestEvent = t.mock.fn(async () => {});

  const service = createLibraryMediaRequestService({
    getAppUserById: t.mock.fn(async () => ({
      id: 'user-new',
      username: 'new-target',
      disabled: false,
      role: 'requester',
    })),
    mediaRequestStore: {
      getMediaRequestById: t.mock.fn(async () => ({
        artistName: 'Massive Attack',
        id: 'request-2',
        releaseTitle: 'Mezzanine',
        requestKind: 'release',
        requestedForUser: { id: 'user-old', role: 'requester', username: 'old-target' },
        requestState: 'needs_fetch',
      })),
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      insertMediaRequestEvent,
      listMediaRequests: async () => ({ mediaRequests: [] }),
      updateRequestedForUserId,
    },
    recordAuditEventFn: async () => {},
  });

  await service.reassignMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequestId: 'request-2',
    newRequestedForUserId: 'user-new',
  });

  assert.equal(insertMediaRequestEvent.mock.callCount(), 1);
  assert.equal(insertMediaRequestEvent.mock.calls[0].arguments[0].reason, null);
});

test('reassignMediaRequest rejects missing newRequestedForUserId', async () => {
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      listMediaRequests: async () => ({ mediaRequests: [] }),
    },
    recordAuditEventFn: async () => {},
  });

  await assert.rejects(
    () => service.reassignMediaRequest({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      mediaRequestId: 'request-1',
      newRequestedForUserId: '',
    }),
    (error) => error?.code === 'validation_error',
  );
});

test('cancelMediaRequest cascades cancellation to fan-out children', async (t) => {
  const getMediaRequestById = t.mock.fn(async () => ({
    artistName: 'Boards of Canada',
    fanOutChildCount: 2,
    id: 'parent-1',
    releaseTitle: 'Music Has the Right to Children',
    requestKind: 'release',
    requestState: 'needs_fetch',
    requestedByUser: { id: 'admin-1', username: 'owner' },
    requestedForUser: { id: 'user-1', username: 'listener' },
  }));

  const updateRequestState = t.mock.fn(async () => true);
  const insertMediaRequestEvent = t.mock.fn(async () => {});
  const cancelFanOutChildren = t.mock.fn(async () => ['child-1', 'child-2']);
  const recordAuditEventFn = t.mock.fn(async () => {});
  const recordActivityEventFn = t.mock.fn(async () => {});

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      cancelFanOutChildren,
      getMediaRequestById,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      insertMediaRequestEvent,
      listMediaRequests: async () => ({ mediaRequests: [] }),
      updateRequestState,
    },
    recordActivityEventFn,
    recordAuditEventFn,
  });

  const result = await service.cancelMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequestId: 'parent-1',
    reason: 'Duplicate',
  });

  assert.equal(result.cancelledChildCount, 2);
  assert.equal(cancelFanOutChildren.mock.callCount(), 1);
  assert.equal(cancelFanOutChildren.mock.calls[0].arguments[0].parentMediaRequestId, 'parent-1');

  assert.equal(insertMediaRequestEvent.mock.callCount(), 3);
  assert.equal(insertMediaRequestEvent.mock.calls[0].arguments[0].mediaRequestId, 'child-1');
  assert.equal(insertMediaRequestEvent.mock.calls[0].arguments[0].eventType, 'cancelled');
  assert.equal(insertMediaRequestEvent.mock.calls[1].arguments[0].mediaRequestId, 'child-2');
  assert.equal(insertMediaRequestEvent.mock.calls[2].arguments[0].mediaRequestId, 'parent-1');

  const auditCalls = recordAuditEventFn.mock.calls.map((c) => c.arguments[0].eventType);
  assert.ok(auditCalls.includes('media_request_cancelled'));
  assert.ok(auditCalls.includes('media_request_fan_out_cancelled'));
});

test('cancelMediaRequest skips cascade when request has no fan-out children', async (t) => {
  const getMediaRequestById = t.mock.fn(async () => ({
    artistName: 'Aphex Twin',
    fanOutChildCount: 0,
    id: 'request-1',
    releaseTitle: 'Selected Ambient Works 85-92',
    requestKind: 'release',
    requestState: 'needs_fetch',
    requestedByUser: { id: 'user-1', username: 'listener' },
    requestedForUser: { id: 'user-1', username: 'listener' },
  }));

  const updateRequestState = t.mock.fn(async () => true);
  const insertMediaRequestEvent = t.mock.fn(async () => {});
  const cancelFanOutChildren = t.mock.fn(async () => []);
  const recordAuditEventFn = t.mock.fn(async () => {});
  const recordActivityEventFn = t.mock.fn(async () => {});

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      cancelFanOutChildren,
      getMediaRequestById,
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 0, needsReview: 0, totalRequests: 0 }),
      insertMediaRequestEvent,
      listMediaRequests: async () => ({ mediaRequests: [] }),
      updateRequestState,
    },
    recordActivityEventFn,
    recordAuditEventFn,
  });

  const result = await service.cancelMediaRequest({
    actorUserId: 'user-1',
    mediaRequestId: 'request-1',
  });

  assert.equal(result.cancelledChildCount, 0);
  assert.equal(cancelFanOutChildren.mock.callCount(), 0);
  assert.equal(insertMediaRequestEvent.mock.callCount(), 1);
  assert.equal(insertMediaRequestEvent.mock.calls[0].arguments[0].mediaRequestId, 'request-1');
});

test('listMediaRequests with cursor returns hasMore and nextCursor without calling countMediaRequests', async (t) => {
  const listMediaRequestsStore = t.mock.fn(async () => ({
    mediaRequests: [
      { id: 'req-1', requestState: 'needs_fetch', requestedByUser: { id: 'u-1' }, requestedForUser: { id: 'u-1' } },
    ],
    hasMore: true,
    nextCursor: 'cursor-2',
  }));
  const countMediaRequests = t.mock.fn(async () => {
    throw new Error('Should not be called');
  });

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      countMediaRequests,
      listMediaRequests: listMediaRequestsStore,
    },
    mediaRequestFulfillmentService: createLibraryMediaRequestFulfillmentService({
      listImportCandidatesBySourceMediaRequestIds: async () => [],
    }),
  });

  const result = await service.listMediaRequests({ cursor: 'cursor-1' });

  assert.equal(result.mediaRequests.length, 1);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextCursor, 'cursor-2');
  assert.equal('totalCount' in result, false);
  assert.equal(countMediaRequests.mock.callCount(), 0);
  assert.equal(listMediaRequestsStore.mock.calls[0].arguments[0].cursor, 'cursor-1');
});

test('listMediaRequests without cursor returns totalCount from countMediaRequests', async (t) => {
  const listMediaRequestsStore = t.mock.fn(async () => ({
    mediaRequests: [
      { id: 'req-1', requestState: 'needs_fetch', requestedByUser: { id: 'u-1' }, requestedForUser: { id: 'u-1' } },
    ],
  }));
  const countMediaRequests = t.mock.fn(async () => 42);

  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      countMediaRequests,
      listMediaRequests: listMediaRequestsStore,
    },
    mediaRequestFulfillmentService: createLibraryMediaRequestFulfillmentService({
      listImportCandidatesBySourceMediaRequestIds: async () => [],
    }),
  });

  const result = await service.listMediaRequests({ requestedForUserId: 'u-1' });

  assert.equal(result.mediaRequests.length, 1);
  assert.equal(result.totalCount, 42);
  assert.equal('hasMore' in result, false);
  assert.equal('nextCursor' in result, false);
  assert.equal(countMediaRequests.mock.callCount(), 1);
});
