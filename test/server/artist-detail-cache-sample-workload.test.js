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
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import { runArtistDetailCacheSampleWorkload } from '../../testing/metadata/artist-detail-cache-sample-workload.js';

test('runs every shared Artist Detail sample through Discography and related-artist reads', async (t) => {
  const browseArtistReleaseGroups = t.mock.fn(async () => ({}));
  const getSimilarArtists = t.mock.fn(async () => ({}));

  const result = await runArtistDetailCacheSampleWorkload({
    browseArtistReleaseGroups,
    getSimilarArtists,
  });

  assert.deepEqual(result, {
    artistCount: artistDetailCacheSampleCatalog.length,
    discographyRequestCount: artistDetailCacheSampleCatalog.length,
    relatedArtistRequestCount: artistDetailCacheSampleCatalog.length,
  });
  assert.equal(browseArtistReleaseGroups.mock.callCount(), artistDetailCacheSampleCatalog.length);
  assert.equal(getSimilarArtists.mock.callCount(), artistDetailCacheSampleCatalog.length);
  assert.deepEqual(browseArtistReleaseGroups.mock.calls[0].arguments[0], {
    artistId: artistDetailCacheSampleCatalog[0].musicBrainzArtistId,
    limit: 25,
    offset: 0,
  });
  assert.deepEqual(getSimilarArtists.mock.calls[0].arguments[0], {
    artistMbid: artistDetailCacheSampleCatalog[0].musicBrainzArtistId,
    limit: 8,
  });
  assert.equal(
    JSON.stringify(result).includes(artistDetailCacheSampleCatalog[0].musicBrainzArtistId),
    false,
  );
});

test('rejects malformed workload dependencies and sample catalogs', async () => {
  await assert.rejects(
    runArtistDetailCacheSampleWorkload({
      getSimilarArtists: async () => ({}),
    }),
    /browseArtistReleaseGroups must be a function/,
  );
  await assert.rejects(
    runArtistDetailCacheSampleWorkload({
      browseArtistReleaseGroups: async () => ({}),
      catalog: [{ musicBrainzArtistId: 'duplicate' }, { musicBrainzArtistId: 'duplicate' }],
      getSimilarArtists: async () => ({}),
    }),
    /sample IDs must be unique/,
  );
});
