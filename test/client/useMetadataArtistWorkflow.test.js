import assert from 'node:assert/strict';
import test from 'node:test';
import { useMetadataArtistWorkflow } from '../../src/client/composables/useMetadataArtistWorkflow.js';

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
    monitoring: { isMonitored: false, monitoredReleaseGroupTypes: ['album', 'ep'] },
    releaseGroups: [],
    releases: [],
  });
  assert.deepEqual(workflow.providerReleaseGroups.value, []);
  assert.equal(workflow.artistActionError.value, 'provider browse unavailable');
  assert.deepEqual(workflow.selectedArtist.value, { id: 'mb-artist-1', name: 'Autechre' });
  assert.equal(workflow.isLoadingArtist.value, false);
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