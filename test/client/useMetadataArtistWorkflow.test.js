import assert from 'node:assert/strict';
import test from 'node:test';
import { useMetadataArtistWorkflow } from '../../src/client/composables/useMetadataArtistWorkflow.js';

/**
 * Polyfill for withResolvers() (available in Node 22+).
 * Returns { promise, resolve, reject } so callers can manually settle the
 * promise, useful for controlling async timing in tests.
 */
function withResolvers() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createReleaseWorkflowDouble(t) {
  return {
    importRelease: t.mock.fn(async () => {}),
    importReleaseGroup: t.mock.fn(async () => {}),
    isImportingRelease: { value: false },
    isImportingReleaseGroup: { value: false },
    isLoadingReleaseGroup: { value: false },
    isOpeningLocalRelease: { value: false },
    isOpeningLocalReleaseGroup: { value: false },
    loadReleaseGroupWorkspace: t.mock.fn(async () => {}),
    localRelease: { value: null },
    localReleaseGroup: { value: null },
    openLocalRelease: t.mock.fn(async () => {}),
    openLocalReleaseGroup: t.mock.fn(async () => {}),
    providerReleases: { value: [] },
    releaseActionError: { value: '' },
    releaseGroupActionError: { value: '' },
    resetReleaseSelection: t.mock.fn(),
  };
}

function createLocalSearchWorkflowDouble() {
  return {
    hasSearchedLocal: { value: false },
    isSearchingLocal: { value: false },
    localArtistResults: { value: [] },
    localReleaseGroupResults: { value: [] },
    localReleaseResults: { value: [] },
    localSearchError: { value: '' },
    localSearchQuery: { value: '' },
    runLocalSearch: async () => {},
  };
}

test('useMetadataArtistWorkflow searches provider artists with normalized query', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const searchArtists = t.mock.fn(async ({ query, limit }) => ({
    search: {
      results: [{ id: 'artist-1', name: query, limit }],
    },
  }));

  const workflow = useMetadataArtistWorkflow({
    searchArtists,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  workflow.searchQuery.value = '  Aphex Twin  ';
  await workflow.runArtistSearch();

  assert.equal(searchArtists.mock.callCount(), 1);
  assert.deepEqual(searchArtists.mock.calls[0].arguments, [{ query: 'Aphex Twin', limit: 8 }]);
  assert.deepEqual(workflow.searchResults.value, [{ id: 'artist-1', name: 'Aphex Twin', limit: 8 }]);
  assert.equal(workflow.searchError.value, '');
  assert.equal(workflow.isSearching.value, false);
});

test('useMetadataArtistWorkflow opens a local artist even when provider browse fails', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const browseArtistReleaseGroups = t.mock.fn(async () => {
    throw new Error('provider browse unavailable');
  });
  const fetchArtist = t.mock.fn(async (artistId) => ({
    artist: { id: artistId, name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [{
      id: 'event-1',
      monitoringDecision: 'wanted_release_detected',
      occurredAt: '2026-05-02T12:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'missing',
      title: 'Sign',
    }],
    detectionEventsPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  }));

  const workflow = useMetadataArtistWorkflow({
    browseArtistReleaseGroups,
    fetchArtist,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  await workflow.openLocalArtist({
    id: 'local-artist-1',
    name: 'Autechre',
    source: { musicbrainzArtistId: 'mb-artist-1' },
  });

  assert.equal(releaseWorkflow.resetReleaseSelection.mock.callCount(), 1);
  assert.equal(fetchArtist.mock.callCount(), 1);
  assert.equal(browseArtistReleaseGroups.mock.callCount(), 1);
  assert.deepEqual(workflow.localArtist.value, {
    artist: { id: 'local-artist-1', name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [{
      id: 'event-1',
      monitoringDecision: 'wanted_release_detected',
      occurredAt: '2026-05-02T12:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'missing',
      title: 'Sign',
    }],
    detectionEventsPageInfo: { hasMore: true, nextCursor: 'cursor-1' },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  });
  assert.deepEqual(workflow.providerReleaseGroups.value, []);
  assert.deepEqual(workflow.detectionEventsPageInfo.value, { hasMore: true, nextCursor: 'cursor-1' });
  assert.equal(workflow.artistActionError.value, 'provider browse unavailable');
  assert.deepEqual(workflow.selectedArtist.value, { id: 'mb-artist-1', name: 'Autechre' });
  assert.equal(workflow.isLoadingArtist.value, false);
});

test('useMetadataArtistWorkflow resolves provider browse after a local open when the input artist lacks a MusicBrainz id', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const browseArtistReleaseGroups = t.mock.fn(async () => ({
    browse: {
      results: [{ id: 'provider-rg-1', title: 'LP5' }],
    },
  }));
  const fetchArtist = t.mock.fn(async (artistId) => ({
    artist: { id: artistId, name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  }));

  const workflow = useMetadataArtistWorkflow({
    browseArtistReleaseGroups,
    fetchArtist,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  await workflow.openLocalArtist({
    id: 'local-artist-1',
    name: 'Autechre',
  });

  assert.equal(browseArtistReleaseGroups.mock.calls[0].arguments[0].artistId, 'mb-artist-1');
  assert.equal(browseArtistReleaseGroups.mock.calls[0].arguments[0].limit, 12);
  assert.equal(browseArtistReleaseGroups.mock.calls[0].arguments[0].releaseGroupStatus, 'website-default');
  assert.ok(browseArtistReleaseGroups.mock.calls[0].arguments[0].signal instanceof AbortSignal);
  assert.deepEqual(workflow.providerReleaseGroups.value, [{ id: 'provider-rg-1', title: 'LP5' }]);
  assert.deepEqual(workflow.selectedArtist.value, { id: 'mb-artist-1', name: 'Autechre' });
});

test('useMetadataArtistWorkflow surfaces local artist open failures', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const workflow = useMetadataArtistWorkflow({
    fetchArtist: async () => {
      throw new Error('local fetch failed');
    },
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  workflow.localArtist.value = { artist: { id: 'old' } };
  workflow.providerReleaseGroups.value = [{ id: 'old-rg' }];

  await workflow.openLocalArtist({
    id: 'local-artist-1',
    name: 'Autechre',
    source: { musicbrainzArtistId: 'mb-artist-1' },
  });

  assert.equal(workflow.artistActionError.value, 'local fetch failed');
  assert.equal(workflow.localArtist.value, null);
  assert.deepEqual(workflow.providerReleaseGroups.value, []);
  assert.equal(workflow.isLoadingArtist.value, false);
});

test('useMetadataArtistWorkflow updates local artist monitoring state through the shared metadata api', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const updateArtistMonitoringRequest = t.mock.fn(async (_artistId, patch) => ({
    artistId: 'local-artist-1',
    monitoring: patch,
  }));
  const workflow = useMetadataArtistWorkflow({
    updateArtistMonitoringRequest,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  workflow.localArtist.value = {
    artist: { id: 'local-artist-1', name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [],
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  };

  await workflow.updateArtistMonitoring({
    isMonitored: true,
    monitoredReleaseGroupTypes: ['album'],
  });

  assert.deepEqual(updateArtistMonitoringRequest.mock.calls[0].arguments, [
    'local-artist-1',
    {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    },
  ]);
  assert.deepEqual(workflow.localArtist.value.monitoring, {
    isMonitored: true,
    monitoredReleaseGroupTypes: ['album'],
  });
  assert.equal(workflow.artistActionError.value, '');
  assert.equal(workflow.isUpdatingArtistMonitoring.value, false);
});

test('useMetadataArtistWorkflow queues a metadata artist refresh through the shared metadata api', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const startMetadataArtistRefreshRequest = t.mock.fn(async (artistId) => ({
    accepted: true,
    run: {
      id: 'run-local-artist-1',
      metadataArtistId: artistId,
    },
  }));
  const workflow = useMetadataArtistWorkflow({
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
    startMetadataArtistRefreshRequest,
  });

  workflow.localArtist.value = {
    artist: { id: 'local-artist-1', name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [],
    monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  };

  const run = await workflow.refreshArtistMetadata();

  assert.deepEqual(startMetadataArtistRefreshRequest.mock.calls[0].arguments, ['local-artist-1']);
  assert.deepEqual(run, {
    id: 'run-local-artist-1',
    metadataArtistId: 'local-artist-1',
  });
  assert.deepEqual(workflow.queuedRefreshRun.value, {
    id: 'run-local-artist-1',
    metadataArtistId: 'local-artist-1',
  });
  assert.equal(workflow.artistActionError.value, '');
  assert.equal(workflow.isRefreshingArtist.value, false);
});

test('useMetadataArtistWorkflow appends paged detection history for the active artist', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const fetchArtistDetectionEvents = t.mock.fn(async (artistId, options) => ({
    detectionEvents: [{
      id: 'event-2',
      metadataReleaseGroupId: 'rg-2',
      monitoringDecision: 'already_satisfied',
      occurredAt: '2026-05-02T11:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'none',
      title: 'Confield',
    }],
    pageInfo: {
      hasMore: false,
      nextCursor: null,
    },
  }));
  const workflow = useMetadataArtistWorkflow({
    fetchArtistDetectionEvents,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  workflow.localArtist.value = {
    artist: { id: 'local-artist-1', name: 'Autechre', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [{
      id: 'event-1',
      metadataReleaseGroupId: 'rg-1',
      monitoringDecision: 'wanted_release_detected',
      occurredAt: '2026-05-02T12:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'missing',
      title: 'Sign',
    }],
    monitoring: { isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  };
  workflow.detectionEventsPageInfo.value = {
    hasMore: true,
    nextCursor: 'cursor-1',
  };

  await workflow.loadMoreDetectionEvents();

  assert.deepEqual(fetchArtistDetectionEvents.mock.calls[0].arguments, ['local-artist-1', { before: 'cursor-1' }]);
  assert.deepEqual(workflow.localArtist.value.detectionEvents, [
    {
      id: 'event-1',
      metadataReleaseGroupId: 'rg-1',
      monitoringDecision: 'wanted_release_detected',
      occurredAt: '2026-05-02T12:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'missing',
      title: 'Sign',
    },
    {
      id: 'event-2',
      metadataReleaseGroupId: 'rg-2',
      monitoringDecision: 'already_satisfied',
      occurredAt: '2026-05-02T11:00:00.000Z',
      primaryType: 'Album',
      resultingWantedStatus: 'none',
      title: 'Confield',
    },
  ]);
  assert.deepEqual(workflow.detectionEventsPageInfo.value, {
    hasMore: false,
    nextCursor: null,
  });
  assert.equal(workflow.detectionEventsErrorMessage.value, '');
});

test('useMetadataArtistWorkflow ignores stale local artist responses when a newer artist open starts', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const firstArtist = withResolvers();
  const secondArtist = withResolvers();
  const firstBrowse = withResolvers();
  const secondBrowse = withResolvers();
  const fetchArtist = t.mock.fn((artistId) => (
    artistId === 'artist-1' ? firstArtist.promise : secondArtist.promise
  ));
  const browseArtistReleaseGroups = t.mock.fn(({ artistId }) => (
    artistId === 'mb-artist-1' ? firstBrowse.promise : secondBrowse.promise
  ));

  const workflow = useMetadataArtistWorkflow({
    browseArtistReleaseGroups,
    fetchArtist,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  const openingFirstArtist = workflow.openLocalArtist({ id: 'artist-1', name: 'First artist' });
  const openingSecondArtist = workflow.openLocalArtist({ id: 'artist-2', name: 'Second artist' });

  secondArtist.resolve({
    artist: { id: 'artist-2', name: 'Second artist', source: { musicbrainzArtistId: 'mb-artist-2' } },
    aliases: [],
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  });
  secondBrowse.resolve({
    browse: {
      results: [{ id: 'provider-rg-2', title: 'Second browse result' }],
    },
  });

  await openingSecondArtist;

  firstArtist.resolve({
    artist: { id: 'artist-1', name: 'First artist', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  });
  firstBrowse.resolve({
    browse: {
      results: [{ id: 'provider-rg-1', title: 'First browse result' }],
    },
  });

  await openingFirstArtist;

  assert.deepEqual(workflow.localArtist.value?.artist, {
    id: 'artist-2',
    name: 'Second artist',
    source: { musicbrainzArtistId: 'mb-artist-2' },
  });
  assert.deepEqual(workflow.providerReleaseGroups.value, [{ id: 'provider-rg-2', title: 'Second browse result' }]);
  assert.deepEqual(workflow.selectedArtist.value, { id: 'mb-artist-2', name: 'Second artist' });
  assert.equal(workflow.isLoadingArtist.value, false);
});

test('useMetadataArtistWorkflow aborts superseded local artist reads', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const firstArtist = withResolvers();
  const secondArtist = withResolvers();
  const artistSignals = [];
  const fetchArtist = t.mock.fn((artistId, { signal } = {}) => {
    artistSignals.push({ artistId, signal });
    return artistId === 'artist-1' ? firstArtist.promise : secondArtist.promise;
  });

  const workflow = useMetadataArtistWorkflow({
    fetchArtist,
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  const openingFirstArtist = workflow.openLocalArtist({
    id: 'artist-1',
    name: 'First artist',
    source: { musicbrainzArtistId: 'mb-artist-1' },
  });
  const openingSecondArtist = workflow.openLocalArtist({
    id: 'artist-2',
    name: 'Second artist',
    source: { musicbrainzArtistId: 'mb-artist-2' },
  });

  assert.equal(artistSignals[0].artistId, 'artist-1');
  assert.equal(artistSignals[0].signal.aborted, true);
  assert.equal(artistSignals[1].artistId, 'artist-2');
  assert.equal(artistSignals[1].signal.aborted, false);

  secondArtist.resolve({
    artist: { id: 'artist-2', name: 'Second artist', source: { musicbrainzArtistId: 'mb-artist-2' } },
    aliases: [],
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  });

  await openingSecondArtist;
  firstArtist.resolve({
    artist: { id: 'artist-1', name: 'First artist', source: { musicbrainzArtistId: 'mb-artist-1' } },
    aliases: [],
    detectionEvents: [],
    detectionEventsPageInfo: { hasMore: false, nextCursor: null },
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album'] },
    releaseGroups: [],
    releases: [],
  });

  await openingFirstArtist;
});

test('useMetadataArtistWorkflow suppresses abort errors for route-owned artist reads', async (t) => {
  const releaseWorkflow = createReleaseWorkflowDouble(t);
  const workflow = useMetadataArtistWorkflow({
    fetchArtist: async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      error.code = 'request_aborted';
      throw error;
    },
    createLocalSearchWorkflow: () => createLocalSearchWorkflowDouble(),
    createReleaseWorkflow: () => releaseWorkflow,
  });

  await workflow.openLocalArtist({
    id: 'local-artist-1',
    name: 'Autechre',
    source: { musicbrainzArtistId: 'mb-artist-1' },
  });

  assert.equal(workflow.artistActionError.value, '');
  assert.equal(workflow.isLoadingArtist.value, false);
});