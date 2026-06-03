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

test('buildDiscoverySearchQuery relaxes second attempt by removing year and normalizing punctuation', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Björk',
    releaseDate: '2001-08-27',
    releaseGroupTitle: 'Vespertine: Live!',
    releaseTitle: null,
    searchAttemptCount: 1,
  }), 'Bjork Vespertine Live');
});

test('buildDiscoverySearchQuery uses guarded title-only fallback on third attempt', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Aphex Twin',
    preferredFormat: 'flac',
    releaseDate: '1994-03-07',
    releaseGroupTitle: 'Selected Ambient Works Volume II',
    searchAttemptCount: 2,
  }), 'Selected Ambient Works Volume II FLAC');
});

test('buildDiscoverySearchQuery rejects unsafe title-only and exhausted fallback attempts', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Autechre',
    releaseGroupTitle: 'Amber',
    searchAttemptCount: 2,
  }), null);
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Autechre',
    releaseGroupTitle: 'Tri Repetae',
    searchAttemptCount: 3,
  }), null);
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
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
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
    albumTitle: 'Confield',
    expectedTrackTitles: null,
    expectedTrackCount: null,
    expectedDurationSeconds: null,
    formatPreferences: null,
    requestOwnership: {
      metadataArtistId: null,
      metadataReleaseGroupId: null,
      metadataReleaseId: 'release-1',
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

test('dispatchReadyDiscoveryRequests threads release tracklist expectations into ingestion', async (t) => {
  const claimedRequests = [{
    metadataReleaseId: 'release-9',
    artistName: 'Autechre',
    releaseDate: '2001-04-30',
    releaseGroupTitle: 'Confield',
    releaseTitle: 'Confield',
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const startSearch = t.mock.fn(async () => ({ id: 'search-9' }));
  const ingestSlskdSearchResponses = t.mock.fn(async () => ({ candidateCount: 1, fileCount: 3 }));
  const getReleaseTracklistExpectationsFn = t.mock.fn(async () => ({
    expectedTrackTitles: ['VI Scose Poise', 'Cfern'],
    expectedTrackCount: 2,
    expectedDurationSeconds: 480,
  }));
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 3,
    getNow: () => now,
    getReleaseTracklistExpectationsFn,
    importCandidateService: { ingestSlskdSearchResponses },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess: t.mock.fn(async () => {}),
    },
    slskdService: { startSearch },
  });

  await service.dispatchReadyDiscoveryRequests({ actorUserId: 'user-1', requestMetadata: {} });

  assert.equal(getReleaseTracklistExpectationsFn.mock.callCount(), 1);
  assert.deepEqual(getReleaseTracklistExpectationsFn.mock.calls[0].arguments[0], {
    metadataReleaseId: 'release-9',
  });
  const ingestArgs = ingestSlskdSearchResponses.mock.calls[0].arguments[0];
  assert.deepEqual(ingestArgs.expectedTrackTitles, ['VI Scose Poise', 'Cfern']);
  assert.equal(ingestArgs.expectedTrackCount, 2);
  assert.equal(ingestArgs.expectedDurationSeconds, 480);
  assert.equal(ingestArgs.albumTitle, 'Confield');
});

test('dispatchReadyDiscoveryRequests still ingests when tracklist expectations lookup fails', async (t) => {
  const claimedRequests = [{
    metadataReleaseId: 'release-9',
    artistName: 'Autechre',
    releaseDate: '2001-04-30',
    releaseGroupTitle: 'Confield',
    releaseTitle: 'Confield',
  }];
  const ingestSlskdSearchResponses = t.mock.fn(async () => ({ candidateCount: 1, fileCount: 3 }));
  const getReleaseTracklistExpectationsFn = t.mock.fn(async () => {
    throw new Error('lookup failed');
  });
  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 3,
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    getReleaseTracklistExpectationsFn,
    importCandidateService: { ingestSlskdSearchResponses },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: t.mock.fn(async () => claimedRequests.shift() ?? null),
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess: t.mock.fn(async () => {}),
    },
    slskdService: { startSearch: t.mock.fn(async () => ({ id: 'search-9' })) },
  });

  await service.dispatchReadyDiscoveryRequests({ actorUserId: 'user-1', requestMetadata: {} });

  assert.equal(ingestSlskdSearchResponses.mock.callCount(), 1);
  const ingestArgs = ingestSlskdSearchResponses.mock.calls[0].arguments[0];
  assert.equal(ingestArgs.expectedTrackTitles, null);
  assert.equal(ingestArgs.expectedTrackCount, null);
});

test('buildDiscoverySearchQuery appends FLAC when preferredFormat is flac', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Aphex Twin',
    preferredFormat: 'flac',
    releaseDate: '2001-10-22',
    releaseGroupTitle: 'Drukqs',
    releaseTitle: 'Drukqs',
  }), 'Aphex Twin Drukqs 2001 FLAC');
});

test('buildDiscoverySearchQuery appends 320 when preferredFormat is mp3_320', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Aphex Twin',
    preferredFormat: 'mp3_320',
    releaseDate: '2001-10-22',
    releaseGroupTitle: 'Drukqs',
  }), 'Aphex Twin Drukqs 2001 320');
});

test('buildDiscoverySearchQuery does not append format when preferredFormat is any', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Aphex Twin',
    preferredFormat: 'any',
    releaseDate: '2001-10-22',
    releaseGroupTitle: 'Drukqs',
  }), 'Aphex Twin Drukqs 2001');
});

test('buildDiscoverySearchQuery does not append format when preferredFormat is null', () => {
  assert.equal(buildDiscoverySearchQuery({
    artistName: 'Aphex Twin',
    releaseDate: '2001-10-22',
    releaseGroupTitle: 'Drukqs',
  }), 'Aphex Twin Drukqs 2001');
});

test('dispatchReadyDiscoveryRequests looks up user preferences and passes them to query and ingestion', async (t) => {
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
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => ({ id: 'search-1' }));
  const ingestSlskdSearchResponses = t.mock.fn(async () => ({
    candidateCount: 1,
    fileCount: 3,
  }));
  const getUserPreferencesFn = t.mock.fn(async () => ({
    preferredFormat: 'flac',
    minimumQuality: 'lossless',
  }));

  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 3,
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    getUserPreferencesFn,
    importCandidateService: { ingestSlskdSearchResponses },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    slskdService: { startSearch },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(getUserPreferencesFn.mock.callCount(), 1);
  assert.deepEqual(getUserPreferencesFn.mock.calls[0].arguments[0], { userId: 'user-7' });

  assert.equal(startSearch.mock.callCount(), 1);
  assert.equal(startSearch.mock.calls[0].arguments[0].query, 'Autechre Confield 2001 FLAC');

  assert.equal(ingestSlskdSearchResponses.mock.callCount(), 1);
  assert.deepEqual(ingestSlskdSearchResponses.mock.calls[0].arguments[0].formatPreferences, {
    preferredFormat: 'flac',
    minimumQuality: 'lossless',
  });
});

test('dispatchReadyDiscoveryRequests continues when getUserPreferencesFn throws', async (t) => {
  const claimedRequests = [{
    artistName: 'Autechre',
    evidence: {
      sourceMediaRequestId: 'request-1',
      sourceRequestedByUserId: 'admin-1',
    },
    metadataReleaseId: 'release-1',
    releaseDate: '2001-04-30',
    releaseGroupTitle: 'Confield',
    releaseTitle: 'Confield',
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => ({ id: 'search-1' }));
  const ingestSlskdSearchResponses = t.mock.fn(async () => ({
    candidateCount: 0,
    fileCount: 0,
  }));
  const getUserPreferencesFn = t.mock.fn(async () => { throw new Error('DB unavailable'); });

  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 3,
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    getUserPreferencesFn,
    importCandidateService: { ingestSlskdSearchResponses },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    slskdService: { startSearch },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(startSearch.mock.callCount(), 1);
  assert.equal(startSearch.mock.calls[0].arguments[0].query, 'Autechre Confield 2001');
  assert.equal(ingestSlskdSearchResponses.mock.calls[0].arguments[0].formatPreferences, null);
  assert.deepEqual(recordDiscoverySearchSuccess.mock.calls[0].arguments[0], {
    candidateCount: 0,
    fileCount: 0,
    metadataReleaseId: 'release-1',
    nextSearchAfter: '2026-04-30T20:00:00.000Z',
    searchAttemptCount: 1,
    searchId: 'search-1',
    searchQuery: 'Autechre Confield 2001',
  });
});

test('dispatchReadyDiscoveryRequests schedules faster fallback after a zero-candidate second attempt', async (t) => {
  const claimedRequests = [{
    artistName: 'Björk',
    evidence: {},
    metadataReleaseId: 'release-vespertine',
    releaseDate: '2001-08-27',
    releaseGroupTitle: 'Vespertine: Live!',
    releaseTitle: null,
    searchAttemptCount: 1,
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => ({ id: 'search-fallback' }));

  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 1,
    fallbackCooldownMs: 2 * 60 * 60 * 1000,
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({
        candidateCount: 0,
        fileCount: 0,
      })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    slskdService: { startSearch },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(startSearch.mock.calls[0].arguments[0].query, 'Bjork Vespertine Live');
  assert.deepEqual(recordDiscoverySearchSuccess.mock.calls[0].arguments[0], {
    candidateCount: 0,
    fileCount: 0,
    metadataReleaseId: 'release-vespertine',
    nextSearchAfter: '2026-04-30T16:00:00.000Z',
    searchAttemptCount: 2,
    searchId: 'search-fallback',
    searchQuery: 'Bjork Vespertine Live',
  });
});

test('dispatchReadyDiscoveryRequests exhausts after a zero-candidate third attempt', async (t) => {
  const claimedRequests = [{
    artistName: 'Aphex Twin',
    evidence: {},
    metadataReleaseId: 'release-saw2',
    releaseDate: '1994-03-07',
    releaseGroupTitle: 'Selected Ambient Works Volume II',
    releaseTitle: null,
    searchAttemptCount: 2,
  }];
  const claimNextReadyAutomaticDiscoveryRequest = t.mock.fn(async () => claimedRequests.shift() ?? null);
  const markDiscoveryRequestExhausted = t.mock.fn(async () => {});
  const onDiscoveryRequestExhaustedFn = t.mock.fn(async () => {});
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => ({ id: 'search-title-only' }));

  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 1,
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({
        candidateCount: 0,
        fileCount: 0,
      })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest,
      markDiscoveryRequestExhausted,
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    onDiscoveryRequestExhaustedFn,
    slskdService: { startSearch },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(startSearch.mock.calls[0].arguments[0].query, 'Selected Ambient Works Volume II');
  assert.deepEqual(recordDiscoverySearchSuccess.mock.calls[0].arguments[0], {
    candidateCount: 0,
    fileCount: 0,
    metadataReleaseId: 'release-saw2',
    nextSearchAfter: null,
    searchAttemptCount: 3,
    searchId: 'search-title-only',
    searchQuery: 'Selected Ambient Works Volume II',
  });
  assert.deepEqual(markDiscoveryRequestExhausted.mock.calls[0].arguments[0], {
    metadataReleaseId: 'release-saw2',
    reasonCode: 'discovery_search_attempts_exhausted',
    searchAttemptCount: 3,
    searchQuery: 'Selected Ambient Works Volume II',
  });
  assert.equal(onDiscoveryRequestExhaustedFn.mock.callCount(), 1);
});

test('dispatchReadyDiscoveryRequests marks already-exhausted automatic requests without starting a search', async (t) => {
  const claimedRequests = [{
    artistName: 'Autechre',
    evidence: {},
    metadataReleaseId: 'release-exhausted',
    releaseGroupTitle: 'Amber',
    searchAttemptCount: 3,
  }];
  const markDiscoveryRequestExhausted = t.mock.fn(async () => {});
  const startSearch = t.mock.fn(async () => {
    throw new Error('search should not start');
  });

  const service = createLibraryDiscoveryDispatchService({
    dispatchBatchSize: 1,
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({ candidateCount: 0, fileCount: 0 })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: t.mock.fn(async () => claimedRequests.shift() ?? null),
      markDiscoveryRequestExhausted,
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess: t.mock.fn(async () => {}),
    },
    slskdService: { startSearch },
  });

  const result = await service.dispatchReadyDiscoveryRequests();

  assert.equal(startSearch.mock.callCount(), 0);
  assert.equal(markDiscoveryRequestExhausted.mock.callCount(), 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0].code, 'discovery_search_attempts_exhausted');
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
