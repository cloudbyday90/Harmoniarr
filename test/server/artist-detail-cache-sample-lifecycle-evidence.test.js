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
import {
  collectArtistDetailCacheSampleLifecycleEvidence,
  withArtistDetailCacheSampleUpstreamCallCount,
} from '../../testing/metadata/artist-detail-cache-sample-lifecycle-evidence.js';

const catalog = [
  { musicBrainzArtistId: 'sample-one' },
  { musicBrainzArtistId: 'sample-two' },
];

test('collects only bounded aggregate lifecycle evidence', async (t) => {
  let currentTimeMs = 0;
  const browseArtistReleaseGroups = t.mock.fn(async () => ({
    cache: { lookup: 'cold', refresh: 'foreground', state: 'fresh' },
  }));
  const getSimilarArtists = t.mock.fn(async () => ({
    cache: { lookup: 'cold', refresh: 'foreground', state: 'fresh' },
  }));

  const evidence = withArtistDetailCacheSampleUpstreamCallCount(
    await collectArtistDetailCacheSampleLifecycleEvidence({
      browseArtistReleaseGroups,
      catalog,
      getSimilarArtists,
      nowMsFn: () => {
        currentTimeMs += 2;
        return currentTimeMs;
      },
      phase: 'cold',
    }),
    8,
  );

  assert.deepEqual(evidence, {
    artistCount: 2,
    discography: {
      cacheLookups: { cold: 2, fresh: 0, stale: 0 },
      cacheStates: { fresh: 2, miss: 0, stale: 0 },
      refreshModes: { background: 0, foreground: 2, none: 0 },
      responseDurationMs: { p95: 4, sampleCount: 2 },
    },
    phase: 'cold',
    relatedArtists: {
      cacheLookups: { cold: 2, fresh: 0, stale: 0 },
      cacheStates: { fresh: 2, miss: 0, stale: 0 },
      refreshModes: { background: 0, foreground: 2, none: 0 },
      responseDurationMs: { p95: 4, sampleCount: 2 },
    },
    upstreamCallCount: 8,
  });
  assert.equal(browseArtistReleaseGroups.mock.callCount(), 2);
  assert.equal(getSimilarArtists.mock.callCount(), 2);
  assert.equal(JSON.stringify(evidence).includes(catalog[0].musicBrainzArtistId), false);
});

test('rejects missing cache metadata and invalid evidence inputs', async () => {
  await assert.rejects(
    collectArtistDetailCacheSampleLifecycleEvidence({
      browseArtistReleaseGroups: async () => ({}),
      catalog: [{ musicBrainzArtistId: 'sample-one' }],
      getSimilarArtists: async () => ({
        cache: { lookup: 'cold', refresh: 'foreground', state: 'fresh' },
      }),
      phase: 'cold',
    }),
    /Discography response must include cache metadata/,
  );
  assert.throws(
    () => withArtistDetailCacheSampleUpstreamCallCount({}, -1),
    /upstreamCallCount must be a non-negative safe integer/,
  );
});
