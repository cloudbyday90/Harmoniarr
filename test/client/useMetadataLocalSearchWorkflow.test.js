import assert from 'node:assert/strict';
import test from 'node:test';
import { useMetadataLocalSearchWorkflow } from '../../src/client/composables/useMetadataLocalSearchWorkflow.js';

test('useMetadataLocalSearchWorkflow populates local search results from injected search functions', async (t) => {
  const searchArtists = t.mock.fn(async ({ query, limit }) => ({
    search: {
      results: [{ id: 'artist-1', name: query, limit }],
    },
  }));
  const searchReleaseGroups = t.mock.fn(async ({ query, limit }) => ({
    search: {
      results: [{ id: 'rg-1', title: query, limit }],
    },
  }));
  const searchReleases = t.mock.fn(async ({ query, limit }) => ({
    search: {
      results: [{ id: 'release-1', title: query, limit }],
    },
  }));

  const workflow = useMetadataLocalSearchWorkflow({
    searchArtists,
    searchReleaseGroups,
    searchReleases,
  });

  workflow.localSearchQuery.value = '  Autechre  ';
  await workflow.runLocalSearch();

  assert.equal(searchArtists.mock.callCount(), 1);
  assert.deepEqual(searchArtists.mock.calls[0].arguments, [{ query: 'Autechre', limit: 6 }]);
  assert.deepEqual(searchReleaseGroups.mock.calls[0].arguments, [{ query: 'Autechre', limit: 6 }]);
  assert.deepEqual(searchReleases.mock.calls[0].arguments, [{ query: 'Autechre', limit: 6 }]);
  assert.equal(workflow.hasSearchedLocal.value, true);
  assert.equal(workflow.isSearchingLocal.value, false);
  assert.deepEqual(workflow.localArtistResults.value, [{ id: 'artist-1', name: 'Autechre', limit: 6 }]);
  assert.deepEqual(workflow.localReleaseGroupResults.value, [{ id: 'rg-1', title: 'Autechre', limit: 6 }]);
  assert.deepEqual(workflow.localReleaseResults.value, [{ id: 'release-1', title: 'Autechre', limit: 6 }]);
  assert.equal(workflow.localSearchError.value, '');
});

test('useMetadataLocalSearchWorkflow clears results for blank queries', async () => {
  const workflow = useMetadataLocalSearchWorkflow();

  workflow.localArtistResults.value = [{ id: 'artist-1' }];
  workflow.localReleaseGroupResults.value = [{ id: 'rg-1' }];
  workflow.localReleaseResults.value = [{ id: 'release-1' }];
  workflow.hasSearchedLocal.value = true;
  workflow.localSearchQuery.value = '   ';

  await workflow.runLocalSearch();

  assert.equal(workflow.hasSearchedLocal.value, false);
  assert.deepEqual(workflow.localArtistResults.value, []);
  assert.deepEqual(workflow.localReleaseGroupResults.value, []);
  assert.deepEqual(workflow.localReleaseResults.value, []);
});

test('useMetadataLocalSearchWorkflow captures failures and resets results', async () => {
  const workflow = useMetadataLocalSearchWorkflow({
    searchArtists: async () => {
      throw new Error('search exploded');
    },
    searchReleaseGroups: async () => ({ search: { results: [{ id: 'ignored-rg' }] } }),
    searchReleases: async () => ({ search: { results: [{ id: 'ignored-release' }] } }),
  });

  workflow.localArtistResults.value = [{ id: 'artist-1' }];
  workflow.localReleaseGroupResults.value = [{ id: 'rg-1' }];
  workflow.localReleaseResults.value = [{ id: 'release-1' }];
  workflow.localSearchQuery.value = 'Boards of Canada';

  await workflow.runLocalSearch();

  assert.equal(workflow.hasSearchedLocal.value, true);
  assert.equal(workflow.isSearchingLocal.value, false);
  assert.equal(workflow.localSearchError.value, 'search exploded');
  assert.deepEqual(workflow.localArtistResults.value, []);
  assert.deepEqual(workflow.localReleaseGroupResults.value, []);
  assert.deepEqual(workflow.localReleaseResults.value, []);
});