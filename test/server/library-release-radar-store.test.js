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
import { createLibraryReleaseRadarStore } from '../../src/server/library/library-release-radar-store.js';

test('listRadarReleaseGroups reads operator-scoped monitored artists', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      artist_name: 'Autechre',
      first_release_date: new Date('2026-05-01T00:00:00.000Z'),
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'rg-1',
      musicbrainz_artist_id: 'mb-artist-1',
      musicbrainz_release_group_id: 'mb-rg-1',
      primary_type: 'Album',
      title: 'NTS Sessions',
    }],
  }));
  const store = createLibraryReleaseRadarStore({
    getPoolFn: () => ({ query }),
  });
  const since = new Date('2026-04-01T00:00:00.000Z');
  const until = new Date('2026-06-01T00:00:00.000Z');

  const rows = await store.listRadarReleaseGroups({
    appUserId: 'user-1',
    limit: 50,
    since,
    until,
  });

  assert.equal(query.mock.callCount(), 1);
  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /operator_artist_monitoring/);
  assert.doesNotMatch(sql, /metadata_artist_monitoring/);
  assert.match(sql, /oam\.app_user_id = \$1/);
  assert.match(sql, /oam\.is_monitored = TRUE/);
  assert.deepEqual(params, ['user-1', since, until, 50]);
  assert.deepEqual(rows, [{
    artistName: 'Autechre',
    firstReleaseDate: '2026-05-01',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    musicbrainzArtistId: 'mb-artist-1',
    musicbrainzReleaseGroupId: 'mb-rg-1',
    releaseGroupTitle: 'NTS Sessions',
    releaseGroupType: 'Album',
  }]);
});
