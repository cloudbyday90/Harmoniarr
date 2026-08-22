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
  buildMetadataProviderCacheBaseline,
  formatMetadataProviderCacheTimestamp,
} from '../../src/client/lib/metadata-provider-cache-observability-presentation.js';

test('metadata provider cache baseline derives bounded lookup and refresh health from fixed metrics', () => {
  const baseline = buildMetadataProviderCacheBaseline({
    namespaces: [{
      cacheNamespace: 'musicbrainz.related_artists',
      cacheStoreErrors: { read: 1, write: 0 },
      lookups: { cold: 2, fresh: 5, stale: 3 },
      refreshes: {
        background: {
          failed: 1,
          inFlight: 0,
          lastCompletedAt: '2026-08-22T12:02:00.000Z',
          lastDurationMs: 18,
          lastFailedAt: '2026-08-22T12:03:00.000Z',
          succeeded: 2,
        },
        foreground: {
          failed: 0,
          inFlight: 1,
          lastCompletedAt: '2026-08-22T12:01:00.000Z',
          lastDurationMs: 23,
          lastFailedAt: null,
          succeeded: 1,
        },
      },
    }],
    observedSinceAt: '2026-08-22T12:00:00.000Z',
    updatedAt: '2026-08-22T12:04:00.000Z',
  });

  assert.equal(baseline.observedSinceAt, '2026-08-22T12:00:00.000Z');
  assert.equal(baseline.updatedAt, '2026-08-22T12:04:00.000Z');
  assert.deepEqual(baseline.totals, {
    activeRefreshCount: 1,
    cacheServedLookups: 8,
    cacheServedRatePercent: 80,
    cacheStoreErrorCount: 1,
    coldLookupRatePercent: 20,
    coldLookups: 2,
    completedRefreshCount: 4,
    refreshFailureCount: 1,
    refreshFailureRatePercent: 25,
    totalLookups: 10,
  });
  assert.deepEqual(baseline.namespaces[0], {
    activeRefreshCount: 1,
    cacheNamespace: 'musicbrainz.related_artists',
    cacheServedLookups: 8,
    cacheServedRatePercent: 80,
    cacheStoreErrorCount: 1,
    coldLookupRatePercent: 20,
    coldLookups: 2,
    completedRefreshCount: 4,
    freshLookups: 5,
    lastRefreshAt: '2026-08-22T12:03:00.000Z',
    refreshFailureCount: 1,
    refreshFailureRatePercent: 25,
    refreshes: {
      background: {
        completed: 3,
        failed: 1,
        inFlight: 0,
        lastCompletedAt: '2026-08-22T12:02:00.000Z',
        lastDurationMs: 18,
        lastFailedAt: '2026-08-22T12:03:00.000Z',
        succeeded: 2,
      },
      foreground: {
        completed: 1,
        failed: 0,
        inFlight: 1,
        lastCompletedAt: '2026-08-22T12:01:00.000Z',
        lastDurationMs: 23,
        lastFailedAt: null,
        succeeded: 1,
      },
    },
    staleLookups: 3,
    totalLookups: 10,
  });
});

test('metadata provider cache baseline ignores malformed namespaces and counts', () => {
  const baseline = buildMetadataProviderCacheBaseline({
    namespaces: [
      { cacheNamespace: 'provider/artist=private-id', lookups: { cold: 99 } },
      { cacheNamespace: 'musicbrainz.artist_release_groups', lookups: { cold: -1, fresh: '2', stale: 1.5 } },
    ],
    observedSinceAt: 'not-a-timestamp',
    updatedAt: null,
  });

  assert.deepEqual(baseline.namespaces.map((namespace) => namespace.cacheNamespace), ['musicbrainz.artist_release_groups']);
  assert.equal(baseline.namespaces[0].totalLookups, 0);
  assert.equal(baseline.observedSinceAt, null);
  assert.equal(baseline.updatedAt, null);
  assert.equal(JSON.stringify(baseline).includes('private-id'), false);
});

test('metadata provider cache baseline formats valid timestamps in explicit UTC and handles missing values', () => {
  assert.equal(formatMetadataProviderCacheTimestamp('2026-08-22T12:00:00.000Z'), '2026-08-22 12:00:00 UTC');
  assert.equal(formatMetadataProviderCacheTimestamp('invalid'), 'Not recorded');
});
