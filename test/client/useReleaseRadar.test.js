/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { useReleaseRadar } from '../../src/client/composables/useReleaseRadar.js';

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

function makeRadarPayload({ recent = [], upcoming = [], checkedAt = '2026-05-07T12:00:00.000Z' } = {}) {
  return {
    ok: true,
    checkedAt,
    recent,
    upcoming,
    windows: { recentDays: 30, upcomingDays: 90 },
  };
}

test('useReleaseRadar starts with empty state and no loading', () => {
  const radar = useReleaseRadar({ fetchRadarFn: async () => makeRadarPayload() });

  assert.deepEqual(radar.recent.value, []);
  assert.deepEqual(radar.upcoming.value, []);
  assert.equal(radar.isLoading.value, false);
  assert.equal(radar.errorMessage.value, '');
  assert.equal(radar.checkedAt.value, null);
});

test('useReleaseRadar load sets isLoading during fetch and clears it on completion', async () => {
  let resolveP;
  const blocker = new Promise((r) => { resolveP = r; });
  const fetchRadarFn = async () => { await blocker; return makeRadarPayload(); };
  const radar = useReleaseRadar({ fetchRadarFn });

  const loadPromise = radar.load();
  assert.equal(radar.isLoading.value, true);

  resolveP(undefined);
  await loadPromise;
  assert.equal(radar.isLoading.value, false);
});

test('useReleaseRadar load populates recent items after successful fetch', async () => {
  const recentItem = makeRadarItem();
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ recent: [recentItem] }),
  });

  await radar.load();

  assert.equal(radar.recent.value.length, 1);
  assert.equal(radar.recent.value[0].title, 'NTS Sessions');
  assert.equal(radar.recent.value[0].id, null); // normalized
});

test('useReleaseRadar load populates upcoming items after successful fetch', async () => {
  const upcomingItem = makeRadarItem({ releaseGroupTitle: 'Drukqs 2', metadataReleaseGroupId: 'rg-2' });
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ upcoming: [upcomingItem] }),
  });

  await radar.load();

  assert.equal(radar.upcoming.value.length, 1);
  assert.equal(radar.upcoming.value[0].title, 'Drukqs 2');
});

test('useReleaseRadar load sets checkedAt from the payload', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ checkedAt: '2026-05-07T08:00:00.000Z' }),
  });

  await radar.load();

  assert.equal(radar.checkedAt.value, '2026-05-07T08:00:00.000Z');
});

test('useReleaseRadar load normalizes items using normalizeRadarReleaseForCard', async () => {
  const item = makeRadarItem({ musicbrainzReleaseGroupId: 'mb-rg-x' });
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ recent: [item] }),
  });

  await radar.load();

  assert.equal(radar.recent.value[0].releaseGroupId, 'mb-rg-x');
});

test('useReleaseRadar load sets errorMessage and clears arrays on API error', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => { throw new Error('API unavailable'); },
  });

  await radar.load();

  assert.equal(radar.errorMessage.value, 'API unavailable');
  assert.deepEqual(radar.recent.value, []);
  assert.deepEqual(radar.upcoming.value, []);
  assert.equal(radar.isLoading.value, false);
});

test('useReleaseRadar load clears previous error before re-fetching', async () => {
  let shouldFail = true;
  const radar = useReleaseRadar({
    fetchRadarFn: async () => {
      if (shouldFail) throw new Error('Temporary error');
      return makeRadarPayload();
    },
  });

  await radar.load();
  assert.equal(radar.errorMessage.value, 'Temporary error');

  shouldFail = false;
  await radar.load();
  assert.equal(radar.errorMessage.value, '');
});

test('useReleaseRadar hasRecent is true when recent items exist', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ recent: [makeRadarItem()] }),
  });

  await radar.load();

  assert.equal(radar.hasRecent.value, true);
});

test('useReleaseRadar hasUpcoming is true when upcoming items exist', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ upcoming: [makeRadarItem()] }),
  });

  await radar.load();

  assert.equal(radar.hasUpcoming.value, true);
});

test('useReleaseRadar isEmpty is true when both recent and upcoming are empty', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload(),
  });

  await radar.load();

  assert.equal(radar.isEmpty.value, true);
});

test('useReleaseRadar isEmpty is false when recent items exist', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => makeRadarPayload({ recent: [makeRadarItem()] }),
  });

  await radar.load();

  assert.equal(radar.isEmpty.value, false);
});

test('useReleaseRadar handles malformed payload gracefully (missing recent/upcoming)', async () => {
  const radar = useReleaseRadar({
    fetchRadarFn: async () => ({ ok: true, checkedAt: '2026-05-07T12:00:00.000Z' }),
  });

  await radar.load();

  assert.deepEqual(radar.recent.value, []);
  assert.deepEqual(radar.upcoming.value, []);
  assert.equal(radar.errorMessage.value, '');
});
