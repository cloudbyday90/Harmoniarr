import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeRadarItem(overrides = {}) {
  return {
    artistName: 'Autechre',
    firstReleaseDate: '2026-04-10',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    musicbrainzArtistId: 'mb-artist-1',
    musicbrainzReleaseGroupId: 'mb-rg-1',
    releaseGroupTitle: 'NTS Sessions',
    releaseGroupType: 'Album',
    ...overrides,
  };
}

function makeRadarPayload({ recent = [], upcoming = [] } = {}) {
  return {
    ok: true,
    checkedAt: '2026-05-07T12:00:00.000Z',
    recent,
    upcoming,
    windows: { recentDays: 30, upcomingDays: 90 },
  };
}

describe('useMonitoredArtists SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    const { isRevalidating, loadMonitoredArtists, destroy } = useMonitoredArtists({
      fetchArtists: async () => ({ results: [{ id: '1', name: 'Radiohead' }] }),
    });

    assert.equal(isRevalidating.value, false);
    await loadMonitoredArtists();
    assert.equal(isRevalidating.value, false);

    destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    const { isRevalidating, loadMonitoredArtists, destroy } = useMonitoredArtists({
      fetchArtists: async () => ({ results: [{ id: '1', name: 'Radiohead' }] }),
    });

    await loadMonitoredArtists();
    const secondLoad = loadMonitoredArtists();
    assert.equal(isRevalidating.value, true);
    await secondLoad;
    assert.equal(isRevalidating.value, false);

    destroy();
  });

  test('preserves stale artists on revalidation error', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    let callCount = 0;
    const fetchArtists = async () => {
      callCount += 1;
      if (callCount === 1) return { results: [{ id: '1', name: 'Radiohead' }] };
      throw new Error('network fail');
    };

    const { artists, loadMonitoredArtists, destroy } = useMonitoredArtists({ fetchArtists });

    await loadMonitoredArtists();
    assert.equal(artists.value.length, 1);

    await loadMonitoredArtists();
    assert.equal(artists.value.length, 1, 'stale artists preserved');

    destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    let callCount = 0;
    const fetchArtists = async () => {
      callCount += 1;
      return { results: [{ id: '1', name: 'Radiohead' }] };
    };

    const { loadMonitoredArtists, destroy } = useMonitoredArtists({ fetchArtists, pollIntervalMs: 30 });

    await loadMonitoredArtists();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    destroy();
  });

  test('destroy stops polling', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    let callCount = 0;
    const fetchArtists = async () => {
      callCount += 1;
      return { results: [{ id: '1', name: 'Radiohead' }] };
    };

    const { loadMonitoredArtists, destroy } = useMonitoredArtists({ fetchArtists, pollIntervalMs: 30 });

    await loadMonitoredArtists();
    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useMonitoredArtists } = await import('../../src/client/composables/useMonitoredArtists.js');

    let callCount = 0;
    const fetchArtists = async () => {
      callCount += 1;
      return { results: [{ id: '1', name: 'Radiohead' }] };
    };

    const { loadMonitoredArtists, destroy } = useMonitoredArtists({ fetchArtists, pollIntervalMs: 0 });

    await loadMonitoredArtists();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    destroy();
  });
});

describe('useReleaseRadar SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    const radar = useReleaseRadar({
      fetchRadarFn: async () => makeRadarPayload({ recent: [makeRadarItem()] }),
    });

    assert.equal(radar.isRevalidating.value, false);
    await radar.load();
    assert.equal(radar.isRevalidating.value, false);

    radar.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    const radar = useReleaseRadar({
      fetchRadarFn: async () => makeRadarPayload({ recent: [makeRadarItem()] }),
    });

    await radar.load();
    const secondLoad = radar.load();
    assert.equal(radar.isRevalidating.value, true);
    await secondLoad;
    assert.equal(radar.isRevalidating.value, false);

    radar.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    let callCount = 0;
    const fetchRadarFn = async () => {
      callCount += 1;
      if (callCount === 1) return makeRadarPayload({ recent: [makeRadarItem()] });
      throw new Error('network fail');
    };

    const radar = useReleaseRadar({ fetchRadarFn });

    await radar.load();
    assert.equal(radar.recent.value.length, 1);

    await radar.load();
    assert.equal(radar.recent.value.length, 1, 'stale radar data preserved');
    assert.ok(radar.errorMessage.value);

    radar.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    let callCount = 0;
    const fetchRadarFn = async () => {
      callCount += 1;
      return makeRadarPayload({ recent: [makeRadarItem()] });
    };

    const radar = useReleaseRadar({ fetchRadarFn, pollIntervalMs: 30 });

    await radar.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    radar.destroy();
  });

  test('destroy stops polling', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    let callCount = 0;
    const fetchRadarFn = async () => {
      callCount += 1;
      return makeRadarPayload({ recent: [makeRadarItem()] });
    };

    const radar = useReleaseRadar({ fetchRadarFn, pollIntervalMs: 30 });

    await radar.load();
    radar.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useReleaseRadar } = await import('../../src/client/composables/useReleaseRadar.js');

    let callCount = 0;
    const fetchRadarFn = async () => {
      callCount += 1;
      return makeRadarPayload({ recent: [makeRadarItem()] });
    };

    const radar = useReleaseRadar({ fetchRadarFn, pollIntervalMs: 0 });

    await radar.load();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    radar.destroy();
  });
});
