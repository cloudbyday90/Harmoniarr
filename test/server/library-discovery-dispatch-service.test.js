import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDiscoverySearchQuery,
  createLibraryDiscoveryDispatchService,
} from '../../src/server/library/library-discovery-dispatch-service.js';

test('buildDiscoverySearchQuery uses canonical artist, release title, and year', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: '  Boards   of Canada ',
    releaseDate: '2002-02-18',
    releaseGroupTitle: 'Geogaddi',
    releaseTitle: ' Geogaddi ',
  }), 'Boards of Canada Geogaddi 2002');
});

test('dispatchReadyDiscoveryRequests claims ready automatic requests, starts searches, and ingests candidates', async (t) => {
  const claimedRequests = [{
    artistName: 'Autechre',
    evidence: {
      sourceMediaRequestId: 'request-1',
      sourceRequestKind: 'release',
      sourceRequestedByUserId: 'admin-1',
      sourceRequestedForUserId: 'user-7',
    },
    metadataReleaseId: 'release-1',
    releaseDate: '2001-04-30',
    releaseGroupTitle: 'Confield',
    releaseTitle: 'Confield',
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const recordDiscoverySearchFailure = t.mock.fn(async () => {});
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => ({
    id: 'search-1',
  }));
  const ingestSlskdSearchResponses = t.mock.fn(async () => ({
    candidateCount: 2,
    fileCount: 5,
  }));
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 3,
    getNow: () => now,
    importCandidateService: {
      ingestSlskdSearchResponses,
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      recordDiscoverySearchFailure,
      recordDiscoverySearchSuccess,
    },
    slskdService: {
      startSearch,
    },
  });

  const result = await service.dispatchReadyDiscoveryRequests({
    actorUserId: 'user-1',
    requestMetadata: {
      ipAddress: '198.51.100.24',
      userAgent: 'HarmoniarrDiscoveryDispatchTest/1.0',
    },
  });

  assert.equal(claimNextReadyAutomaticDiscoveryRequest.mock.callCount(), 2);
  assert.deepEqual(claimNextReadyAutomaticDiscoveryRequest.mock.calls[0].arguments[0], {
    dispatchedAt: '2026-04-30T14:00:00.000Z',
    nextSearchAfter: '2026-04-30T20:00:00.000Z',
  });
  assert.equal(startSearch.mock.callCount(), 1);
  assert.deepEqual(startSearch.mock.calls[0].arguments[0], {
    query: 'Autechre Confield 2001',
  });
  assert.equal(ingestSlskdSearchResponses.mock.callCount(), 1);
  assert.deepEqual(ingestSlskdSearchResponses.mock.calls[0].arguments[0], {
    actorUserId: 'user-1',
    requestOwnership: {
      sourceMediaRequestId: 'request-1',
      sourceRequestKind: 'release',
      sourceRequestedByUserId: 'admin-1',
      sourceRequestedForUserId: 'user-7',
      sourceType: 'media_request',
    },
    requestMetadata: {
      ipAddress: '198.51.100.24',
      userAgent: 'HarmoniarrDiscoveryDispatchTest/1.0',
    },
    searchId: 'search-1',
  });
  assert.equal(recordDiscoverySearchSuccess.mock.callCount(), 1);
  assert.deepEqual(recordDiscoverySearchSuccess.mock.calls[0].arguments[0], {
    candidateCount: 2,
    fileCount: 5,
    metadataReleaseId: 'release-1',
    searchId: 'search-1',
    searchQuery: 'Autechre Confield 2001',
  });
  assert.equal(recordDiscoverySearchFailure.mock.callCount(), 0);
  assert.deepEqual(result, {
    attemptedCount: 1,
    candidateCount: 2,
    dispatchedCount: 1,
    dispatchedSearches: [{
      candidateCount: 2,
      fileCount: 5,
      metadataReleaseId: 'release-1',
      query: 'Autechre Confield 2001',
      searchId: 'search-1',
    }],
    failedCount: 0,
    failures: [],
    fileCount: 5,
  });
});

test('dispatchReadyDiscoveryRequests records failures without failing the whole batch', async (t) => {
  const claimedRequests = [{
    artistName: 'Telefon Tel Aviv',
    metadataReleaseId: 'release-9',
    releaseDate: '2001-08-07',
    releaseGroupTitle: 'Fahrenheit Fair Enough',
    releaseTitle: 'Fahrenheit Fair Enough',
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const recordDiscoverySearchFailure = t.mock.fn(async () => {});
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => {
    const error = new Error('slskd is temporarily unavailable');
    error.code = 'slskd_unavailable';
    throw error;
  });
  const service = createLibraryDiscoveryDispatchService({
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({
        candidateCount: 0,
        fileCount: 0,
      })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      recordDiscoverySearchFailure,
      recordDiscoverySearchSuccess,
    },
    slskdService: {
      startSearch,
    },
  });

  const result = await service.dispatchReadyDiscoveryRequests();

  assert.equal(recordDiscoverySearchSuccess.mock.callCount(), 0);
  assert.equal(recordDiscoverySearchFailure.mock.callCount(), 1);
  assert.deepEqual(recordDiscoverySearchFailure.mock.calls[0].arguments[0], {
    errorCode: 'slskd_unavailable',
    errorMessage: 'slskd is temporarily unavailable',
    metadataReleaseId: 'release-9',
    searchQuery: 'Telefon Tel Aviv Fahrenheit Fair Enough 2001',
  });
  assert.deepEqual(result, {
    attemptedCount: 1,
    candidateCount: 0,
    dispatchedCount: 0,
    dispatchedSearches: [],
    failedCount: 1,
    failures: [{
      code: 'slskd_unavailable',
      message: 'slskd is temporarily unavailable',
      metadataReleaseId: 'release-9',
    }],
    fileCount: 0,
  });
});