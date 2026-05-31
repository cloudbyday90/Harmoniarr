import assert from 'node:assert/strict';
import test from 'node:test';
import { useMonitoredArtistSummaries } from '../../src/client/composables/useMonitoredArtistSummaries.js';
import {
  mapOperatorProjectionToMonitoredArtistSummary,
  mapOperatorProjectionsToMonitoredArtistSummaries,
} from '../../src/client/lib/operator-monitored-artist-summary.js';

function makeProjection(overrides = {}) {
  return {
    artist: {
      country: 'GB',
      disambiguation: 'Electronic duo',
      id: 'metadata-artist-1',
      musicBrainzArtistId: 'mb-artist-1',
      name: 'Autechre',
      sortName: 'Autechre',
      type: 'Group',
      ...overrides.artist,
    },
    operator: {
      monitoring: {
        isMonitored: true,
        lastSavedSnapshotAt: '2026-05-30T10:00:00.000Z',
        metadataArtistId: 'metadata-artist-1',
        ...overrides.monitoring,
      },
      ...overrides.operator,
    },
  };
}

function createFetchDouble(results = []) {
  return async ({ limit, signal }) => ({ limit, results, signal });
}

test('mapOperatorProjectionToMonitoredArtistSummary exposes MusicBrainz id as the route id', () => {
  const summary = mapOperatorProjectionToMonitoredArtistSummary(makeProjection());

  assert.equal(summary.id, 'mb-artist-1');
  assert.equal(summary.localId, 'metadata-artist-1');
  assert.equal(summary.name, 'Autechre');
  assert.equal(summary.addedAt, '2026-05-30T10:00:00.000Z');
  assert.equal(summary.monitored, true);
  assert.equal(summary.projection.artist.id, 'metadata-artist-1');
});

test('mapOperatorProjectionsToMonitoredArtistSummaries skips projections without a routable MusicBrainz artist id', () => {
  const summaries = mapOperatorProjectionsToMonitoredArtistSummaries([
    makeProjection({ artist: { musicBrainzArtistId: 'mb-artist-1', name: 'Autechre' } }),
    makeProjection({ artist: { musicBrainzArtistId: null, name: 'Local Only' } }),
    makeProjection({ artist: { musicBrainzArtistId: 'mb-artist-3', name: null } }),
  ]);

  assert.deepEqual(summaries.map((summary) => summary.id), ['mb-artist-1']);
});

test('useMonitoredArtistSummaries loadMonitoredArtistSummaries populates artists from operator projection results', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([
    makeProjection({ artist: { musicBrainzArtistId: 'mb-1', name: 'Radiohead' } }),
    makeProjection({ artist: { musicBrainzArtistId: 'mb-2', name: 'Bjork' } }),
  ]));

  const {
    artists,
    isLoading,
    loadMonitoredArtistSummaries,
  } = useMonitoredArtistSummaries({ fetchArtists });

  await loadMonitoredArtistSummaries();

  assert.equal(artists.value.length, 2);
  assert.equal(artists.value[0].id, 'mb-1');
  assert.equal(artists.value[0].name, 'Radiohead');
  assert.equal(artists.value[1].id, 'mb-2');
  assert.equal(artists.value[1].name, 'Bjork');
  assert.equal(isLoading.value, false);
});

test('useMonitoredArtistSummaries passes limit and abort signal to fetchArtists', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([]));

  const { loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({ limit: 10, fetchArtists });
  await loadMonitoredArtistSummaries();

  const args = fetchArtists.mock.calls[0].arguments[0];
  assert.equal(fetchArtists.mock.callCount(), 1);
  assert.equal(args.limit, 10);
  assert.ok(args.signal instanceof AbortSignal);
});

test('useMonitoredArtistSummaries defaults to limit 25', async (t) => {
  const fetchArtists = t.mock.fn(createFetchDouble([]));

  const { loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({ fetchArtists });
  await loadMonitoredArtistSummaries();

  assert.equal(fetchArtists.mock.calls[0].arguments[0].limit, 25);
});

test('useMonitoredArtistSummaries treats missing results array as empty', async () => {
  const { artists, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({
    fetchArtists: async () => ({}),
  });

  await loadMonitoredArtistSummaries();

  assert.deepEqual(artists.value, []);
});

test('useMonitoredArtistSummaries sets errorMessage on failure', async () => {
  const { errorMessage, isLoading, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({
    fetchArtists: async () => { throw new Error('network timeout'); },
  });

  await loadMonitoredArtistSummaries();

  assert.equal(errorMessage.value, 'network timeout');
  assert.equal(isLoading.value, false);
});

test('useMonitoredArtistSummaries uses fallback error message when error is not an Error instance', async () => {
  const { errorMessage, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({
    fetchArtists: async () => { throw 'string error'; },
  });

  await loadMonitoredArtistSummaries();

  assert.equal(errorMessage.value, 'Could not load your monitored artists.');
});

test('useMonitoredArtistSummaries resets artists to empty on first-load failure', async () => {
  const { artists, errorMessage, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({
    fetchArtists: async () => { throw new Error('gone'); },
  });

  await loadMonitoredArtistSummaries();

  assert.deepEqual(artists.value, []);
  assert.equal(errorMessage.value, 'gone');
});

test('useMonitoredArtistSummaries clears previous errorMessage on successful reload', async () => {
  let callCount = 0;
  const fetchArtists = async ({ limit, signal }) => {
    callCount += 1;
    if (callCount === 1) throw new Error('first call failed');
    return createFetchDouble([makeProjection()])({ limit, signal });
  };

  const { artists, errorMessage, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({ fetchArtists });

  await loadMonitoredArtistSummaries();
  assert.ok(errorMessage.value.length > 0);

  await loadMonitoredArtistSummaries();
  assert.equal(errorMessage.value, '');
  assert.equal(artists.value.length, 1);
});

test('useMonitoredArtistSummaries aborts an active load when destroyed', async () => {
  let capturedSignal = null;
  const { destroy, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({
    fetchArtists: async ({ signal }) => {
      capturedSignal = signal;
      await new Promise(() => {});
    },
  });

  void loadMonitoredArtistSummaries();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  destroy();

  assert.equal(capturedSignal.aborted, true);
});

test('useMonitoredArtistSummaries ignores stale responses from overlapping loads', async () => {
  let resolveStaleLoad;
  let callCount = 0;
  const staleLoadPayload = new Promise((resolve) => {
    resolveStaleLoad = resolve;
  });
  const fetchArtists = async () => {
    callCount += 1;
    if (callCount > 1) {
      return { results: [makeProjection({ artist: { musicBrainzArtistId: 'mb-new', name: 'New Artist' } })] };
    }

    return staleLoadPayload;
  };

  const { artists, loadMonitoredArtistSummaries } = useMonitoredArtistSummaries({ fetchArtists });

  const staleLoad = loadMonitoredArtistSummaries();
  const freshLoad = loadMonitoredArtistSummaries();
  resolveStaleLoad({
    results: [makeProjection({ artist: { musicBrainzArtistId: 'mb-old', name: 'Old Artist' } })],
  });

  await Promise.all([staleLoad, freshLoad]);

  assert.deepEqual(artists.value.map((artist) => artist.id), ['mb-new']);
});
