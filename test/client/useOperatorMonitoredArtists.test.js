import assert from 'node:assert/strict';
import test from 'node:test';
import { useOperatorMonitoredArtists } from '../../src/client/composables/useOperatorMonitoredArtists.js';

function createFetchDouble(results = []) {
  return async ({ limit }) => ({ limit, results });
}

test('useOperatorMonitoredArtists populates operator projections from API results', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([
    {
      artist: { id: 'artist-1', musicBrainzArtistId: 'mbid-1', name: 'Autechre' },
      operator: { monitoring: { isMonitored: true } },
    },
  ]));

  const { artists, isLoading, loadOperatorMonitoredArtists } = useOperatorMonitoredArtists({ fetchArtists });

  await loadOperatorMonitoredArtists();

  assert.equal(fetchArtists.mock.calls[0].arguments[0].limit, 50);
  assert.equal(artists.value.length, 1);
  assert.equal(artists.value[0].artist.name, 'Autechre');
  assert.equal(isLoading.value, false);
});

test('useOperatorMonitoredArtists accepts a custom limit', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([]));
  const { loadOperatorMonitoredArtists } = useOperatorMonitoredArtists({ fetchArtists, limit: 12 });

  await loadOperatorMonitoredArtists();

  assert.deepEqual(fetchArtists.mock.calls[0].arguments[0], { limit: 12 });
});

test('useOperatorMonitoredArtists exposes a fallback error message on failure', async () => {
  const { artists, errorMessage, isLoading, loadOperatorMonitoredArtists } = useOperatorMonitoredArtists({
    fetchArtists: async () => { throw 'network failed'; },
  });

  await loadOperatorMonitoredArtists();

  assert.deepEqual(artists.value, []);
  assert.equal(errorMessage.value, 'Could not load your monitored artist profile.');
  assert.equal(isLoading.value, false);
});

test('useOperatorMonitoredArtists keeps stale artists during revalidation failure', async () => {
  let callCount = 0;
  const fetchArtists = async () => {
    callCount += 1;
    if (callCount === 1) {
      return createFetchDouble([{ artist: { id: 'artist-1', name: 'Radiohead' } }])({ limit: 50 });
    }
    throw new Error('server unavailable');
  };

  const { artists, errorMessage, loadOperatorMonitoredArtists } = useOperatorMonitoredArtists({ fetchArtists });

  await loadOperatorMonitoredArtists();
  await loadOperatorMonitoredArtists();

  assert.equal(artists.value.length, 1);
  assert.equal(errorMessage.value, 'server unavailable');
});
