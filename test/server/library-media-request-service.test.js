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
    requestedForUser: { id: payload.requestedForUserId, username: 'listener', role: 'requester' },
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
      listMediaRequests: async () => ([
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
      ]),
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
      getMediaRequestCounts: async () => ({ alreadyExists: 0, needsFetch: 1, needsReview: 0, totalRequests: 1 }),
      listMediaRequests: async () => [],
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