import assert from 'node:assert/strict';
import test from 'node:test';
import { useMonitoredArtists } from '../../src/client/composables/useMonitoredArtists.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFetchDouble(results = []) {
  return async ({ limit }) => ({ limit, results });
}

// ---------------------------------------------------------------------------
// loadMonitoredArtists — happy path
// ---------------------------------------------------------------------------

test('useMonitoredArtists loadMonitoredArtists populates artists from API results', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([
    { id: 'mb-1', name: 'Radiohead', type: 'Group', country: 'GB', monitored: true },
    { id: 'mb-2', name: 'Björk', type: 'Person', country: 'IS', monitored: true },
  ]));

  const { artists, isLoading, loadMonitoredArtists } = useMonitoredArtists({ fetchArtists });

  await loadMonitoredArtists();

  assert.equal(artists.value.length, 2);
  assert.equal(artists.value[0].name, 'Radiohead');
  assert.equal(artists.value[1].name, 'Björk');
  assert.equal(isLoading.value, false);
});

test('useMonitoredArtists loadMonitoredArtists passes limit to fetchArtists', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([]));

  const { loadMonitoredArtists } = useMonitoredArtists({ limit: 10, fetchArtists });
  await loadMonitoredArtists();

  assert.equal(fetchArtists.mock.callCount(), 1);
  assert.deepEqual(fetchArtists.mock.calls[0].arguments[0], { limit: 10 });
});

test('useMonitoredArtists loadMonitoredArtists defaults to limit 25', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([]));

  const { loadMonitoredArtists } = useMonitoredArtists({ fetchArtists });
  await loadMonitoredArtists();

  assert.equal(fetchArtists.mock.calls[0].arguments[0].limit, 25);
});

test('useMonitoredArtists loadMonitoredArtists sets isLoading false on success', async (t) => {
  const { isLoading, loadMonitoredArtists } = useMonitoredArtists({
    fetchArtists: t.mock.fn(createFetchDouble([])),
  });

  await loadMonitoredArtists();

  assert.equal(isLoading.value, false);
});

test('useMonitoredArtists loadMonitoredArtists treats missing results array as empty', async (t) => {
  const { artists, loadMonitoredArtists } = useMonitoredArtists({
    fetchArtists: async () => ({}),
  });

  await loadMonitoredArtists();

  assert.deepEqual(artists.value, []);
});

// ---------------------------------------------------------------------------
// loadMonitoredArtists — error handling
// ---------------------------------------------------------------------------

test('useMonitoredArtists loadMonitoredArtists sets errorMessage on failure', async (t) => {
  const { errorMessage, isLoading, loadMonitoredArtists } = useMonitoredArtists({
    fetchArtists: async () => { throw new Error('network timeout'); },
  });

  await loadMonitoredArtists();

  assert.equal(errorMessage.value, 'network timeout');
  assert.equal(isLoading.value, false);
});

test('useMonitoredArtists loadMonitoredArtists uses fallback error message when error is not an Error instance', async (t) => {
  const { errorMessage, loadMonitoredArtists } = useMonitoredArtists({
    fetchArtists: async () => { throw 'string error'; },
  });

  await loadMonitoredArtists();

  assert.equal(errorMessage.value, 'Could not load your monitored artists.');
});

test('useMonitoredArtists loadMonitoredArtists resets artists to empty on failure', async (t) => {
  const { artists, errorMessage, loadMonitoredArtists } = useMonitoredArtists({
    fetchArtists: async () => { throw new Error('gone'); },
  });

  await loadMonitoredArtists();

  assert.deepEqual(artists.value, []);
  assert.equal(errorMessage.value, 'gone');
});

test('useMonitoredArtists loadMonitoredArtists clears previous errorMessage on successful reload', async (t) => {
  let callCount = 0;
  const fetchArtists = async ({ limit }) => {
    callCount++;
    if (callCount === 1) throw new Error('first call failed');
    return createFetchDouble([{ id: 'mb-1', name: 'Radiohead', monitored: true }])({ limit });
  };

  const { artists, errorMessage, loadMonitoredArtists } = useMonitoredArtists({ fetchArtists });

  await loadMonitoredArtists();
  assert.ok(errorMessage.value.length > 0);

  await loadMonitoredArtists();
  assert.equal(errorMessage.value, '');
  assert.equal(artists.value.length, 1);
});
