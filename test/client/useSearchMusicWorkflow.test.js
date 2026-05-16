import assert from 'node:assert/strict';
import test from 'node:test';
import { useSearchMusicWorkflow } from '../../src/client/composables/useSearchMusicWorkflow.js';

test('useSearchMusicWorkflow trims the query, populates results, and resolves shared artwork requests', async (t) => {
  const resolveArtworkFn = t.mock.fn(async () => {});
  const searchArtists = t.mock.fn(async ({ query, limit }) => ({
    search: {
      results: [{ id: 'artist-1', name: query, limit }],
    },
  }));
  const searchReleases = t.mock.fn(async ({ artist, release, limit }) => ({
    search: {
      results: [{
        artistCredit: [{ artist: { name: artist } }],
        id: 'release-1',
        releaseGroup: { id: 'rg-1' },
        title: release,
      }],
    },
  }));

  const workflow = useSearchMusicWorkflow({
    resolveArtworkFn,
    searchArtists,
    searchReleases,
  });

  workflow.musicQuery.value = '  Radiohead  ';
  await workflow.runMusicSearch();

  assert.deepEqual(searchArtists.mock.calls[0].arguments, [{ query: 'Radiohead', limit: 10 }]);
  assert.deepEqual(searchReleases.mock.calls[0].arguments, [{ artist: 'Radiohead', release: 'Radiohead', limit: 20 }]);
  assert.equal(workflow.hasMusicSearched.value, true);
  assert.equal(workflow.isMusicSearching.value, false);
  assert.equal(workflow.musicResultCount.value, 2);
  assert.equal(workflow.hasMusicResults.value, true);
  assert.equal(resolveArtworkFn.mock.callCount(), 1);
  assert.equal(resolveArtworkFn.mock.calls[0].arguments[0].length, 3);
});

test('useSearchMusicWorkflow skips blank queries', async (t) => {
  const searchArtists = t.mock.fn();
  const workflow = useSearchMusicWorkflow({ searchArtists });

  workflow.musicQuery.value = '   ';
  await workflow.runMusicSearch();

  assert.equal(searchArtists.mock.callCount(), 0);
  assert.equal(workflow.hasMusicSearched.value, false);
});

test('useSearchMusicWorkflow captures failures and clears stale results', async () => {
  const workflow = useSearchMusicWorkflow({
    searchArtists: async () => {
      throw new Error('search exploded');
    },
    searchReleases: async () => ({ search: { results: [{ id: 'ignored-release' }] } }),
  });

  workflow.musicArtistResults.value = [{ id: 'artist-1' }];
  workflow.musicReleaseResults.value = [{ id: 'release-1' }];
  workflow.musicQuery.value = 'Boards of Canada';

  await workflow.runMusicSearch();

  assert.equal(workflow.hasMusicSearched.value, true);
  assert.equal(workflow.isMusicSearching.value, false);
  assert.equal(workflow.musicSearchError.value, 'search exploded');
  assert.deepEqual(workflow.musicArtistResults.value, []);
  assert.deepEqual(workflow.musicReleaseResults.value, []);
});
