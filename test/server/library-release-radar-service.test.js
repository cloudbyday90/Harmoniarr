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
import { createLibraryReleaseRadarService } from '../../src/server/library/library-release-radar-service.js';

const recentRow = {
  artistName: 'Autechre',
  firstReleaseDate: '2026-04-10',
  metadataArtistId: 'artist-1',
  metadataReleaseGroupId: 'rg-1',
  musicbrainzArtistId: 'mb-artist-1',
  musicbrainzReleaseGroupId: 'mb-rg-1',
  releaseGroupTitle: 'NTS Sessions',
  releaseGroupType: 'Album',
};

const upcomingRow = {
  artistName: 'Aphex Twin',
  firstReleaseDate: '2026-06-15',
  metadataArtistId: 'artist-2',
  metadataReleaseGroupId: 'rg-2',
  musicbrainzArtistId: 'mb-artist-2',
  musicbrainzReleaseGroupId: 'mb-rg-2',
  releaseGroupTitle: 'Drukqs 2',
  releaseGroupType: 'Album',
};

function createMockStore(rows = []) {
  return {
    listRadarReleaseGroups: async () => rows,
  };
}

test('buildReleaseRadar returns checkedAt, windows, and empty arrays when the store returns no rows', async () => {
  const now = new Date('2026-05-07T12:00:00.000Z');
  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore([]),
    nowFn: () => now,
  });

  const result = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(result.checkedAt, now.toISOString());
  assert.deepEqual(result.recent, []);
  assert.deepEqual(result.upcoming, []);
  assert.deepEqual(result.windows, { recentDays: 30, upcomingDays: 90 });
});

test('buildReleaseRadar splits rows at today: past dates go to recent, future dates go to upcoming', async () => {
  const now = new Date('2026-05-07T00:00:00.000Z');
  const rows = [
    { ...recentRow, firstReleaseDate: '2026-04-10' },
    { ...upcomingRow, firstReleaseDate: '2026-06-15' },
  ];

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore(rows),
    nowFn: () => now,
  });

  const result = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(result.recent.length, 1);
  assert.equal(result.recent[0].releaseGroupTitle, 'NTS Sessions');
  assert.equal(result.upcoming.length, 1);
  assert.equal(result.upcoming[0].releaseGroupTitle, 'Drukqs 2');
});

test('buildReleaseRadar orders recent releases newest-first', async () => {
  const now = new Date('2026-05-07T00:00:00.000Z');
  const rows = [
    { ...recentRow, firstReleaseDate: '2026-04-01', releaseGroupTitle: 'Older' },
    { ...recentRow, firstReleaseDate: '2026-04-20', releaseGroupTitle: 'Newer', metadataReleaseGroupId: 'rg-x' },
  ];

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore(rows),
    nowFn: () => now,
  });

  const { recent } = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(recent[0].releaseGroupTitle, 'Newer');
  assert.equal(recent[1].releaseGroupTitle, 'Older');
});

test('buildReleaseRadar orders upcoming releases soonest-first', async () => {
  const now = new Date('2026-05-07T00:00:00.000Z');
  const rows = [
    { ...upcomingRow, firstReleaseDate: '2026-05-20', releaseGroupTitle: 'Sooner' },
    { ...upcomingRow, firstReleaseDate: '2026-07-01', releaseGroupTitle: 'Later', metadataReleaseGroupId: 'rg-y' },
  ];

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore(rows),
    nowFn: () => now,
  });

  const { upcoming } = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(upcoming[0].releaseGroupTitle, 'Sooner');
  assert.equal(upcoming[1].releaseGroupTitle, 'Later');
});

test('buildReleaseRadar returns default window values in result', async () => {
  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore([]),
  });

  const { windows } = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(windows.recentDays, 30);
  assert.equal(windows.upcomingDays, 90);
});

test('buildReleaseRadar reflects custom window parameters in result', async () => {
  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore([]),
  });

  const { windows } = await service.buildReleaseRadar({
    appUserId: 'user-1',
    recentDays: 7,
    upcomingDays: 14,
  });

  assert.equal(windows.recentDays, 7);
  assert.equal(windows.upcomingDays, 14);
});

test('buildReleaseRadar passes the correct since/until date range to the store', async (t) => {
  const now = new Date('2026-05-07T12:00:00.000Z');
  const listRadarReleaseGroups = t.mock.fn(async () => []);

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: { listRadarReleaseGroups },
    nowFn: () => now,
  });

  await service.buildReleaseRadar({ appUserId: 'user-1', recentDays: 30, upcomingDays: 90 });

  const [callArgs] = listRadarReleaseGroups.mock.calls;
  const { appUserId, since, until } = callArgs.arguments[0];

  const expectedSince = new Date(now);
  expectedSince.setDate(expectedSince.getDate() - 30);

  const expectedUntil = new Date(now);
  expectedUntil.setDate(expectedUntil.getDate() + 90);

  assert.equal(appUserId, 'user-1');
  assert.equal(since.toISOString(), expectedSince.toISOString());
  assert.equal(until.toISOString(), expectedUntil.toISOString());
});

test('buildReleaseRadar requires an app user id', async () => {
  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore([]),
  });

  await assert.rejects(
    () => service.buildReleaseRadar(),
    /requires an appUserId/,
  );
});

test('buildReleaseRadar treats a release with firstReleaseDate equal to today as recent, not upcoming', async () => {
  const now = new Date('2026-05-07T00:00:00.000Z');
  const todayRow = { ...recentRow, firstReleaseDate: '2026-05-07', releaseGroupTitle: 'Released Today' };

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore([todayRow]),
    nowFn: () => now,
  });

  const { recent, upcoming } = await service.buildReleaseRadar({ appUserId: 'user-1' });

  assert.equal(recent.length, 1);
  assert.equal(recent[0].releaseGroupTitle, 'Released Today');
  assert.equal(upcoming.length, 0);
});

test('buildReleaseRadar respects the limit cap per section', async () => {
  const now = new Date('2026-05-07T00:00:00.000Z');
  const rows = Array.from({ length: 10 }, (_, i) => ({
    ...recentRow,
    firstReleaseDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
    metadataReleaseGroupId: `rg-${i}`,
    releaseGroupTitle: `Release ${i}`,
  }));

  const service = createLibraryReleaseRadarService({
    libraryReleaseRadarStore: createMockStore(rows),
    nowFn: () => now,
  });

  const { recent } = await service.buildReleaseRadar({ appUserId: 'user-1', limit: 5 });

  assert.equal(recent.length, 5);
});
