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
  buildMetadataProviderCacheBaselineComparison,
  createMetadataProviderCacheBaselineComparisonSnapshot,
} from '../../src/client/lib/metadata-provider-cache-baseline-comparison.js';

function createBaseline({
  namespaces = [],
  observedSinceAt = '2026-08-22T12:00:00.000Z',
  updatedAt = '2026-08-22T12:01:00.000Z',
} = {}) {
  return { namespaces, observedSinceAt, updatedAt };
}

function createNamespace({
  activeRefreshCount = 0,
  cacheNamespace,
  cacheStoreErrorCount = 0,
  coldLookups = 0,
  completedRefreshCount = 0,
  freshLookups = 0,
  refreshFailureCount = 0,
  staleLookups = 0,
}) {
  return {
    activeRefreshCount,
    cacheNamespace,
    cacheStoreErrorCount,
    coldLookups,
    completedRefreshCount,
    freshLookups,
    refreshFailureCount,
    staleLookups,
  };
}

test('metadata provider cache baseline comparison derives same-process aggregate and namespace deltas', () => {
  const reference = createBaseline({
    namespaces: [
      createNamespace({
        cacheNamespace: 'musicbrainz.artist_release_groups',
        coldLookups: 1,
        completedRefreshCount: 1,
        freshLookups: 4,
        staleLookups: 1,
      }),
      createNamespace({
        cacheNamespace: 'musicbrainz.related_artists',
        coldLookups: 1,
        completedRefreshCount: 1,
        freshLookups: 1,
      }),
    ],
  });
  const current = createBaseline({
    namespaces: [
      createNamespace({
        activeRefreshCount: 1,
        cacheNamespace: 'musicbrainz.artist_release_groups',
        cacheStoreErrorCount: 1,
        coldLookups: 1,
        completedRefreshCount: 2,
        freshLookups: 7,
        staleLookups: 2,
      }),
      createNamespace({
        cacheNamespace: 'musicbrainz.related_artists',
        cacheStoreErrorCount: 1,
        coldLookups: 2,
        completedRefreshCount: 3,
        freshLookups: 1,
        refreshFailureCount: 1,
        staleLookups: 2,
      }),
    ],
    updatedAt: '2026-08-22T12:03:00.000Z',
  });

  const comparison = buildMetadataProviderCacheBaselineComparison(reference, current);

  assert.equal(comparison.canCompare, true);
  assert.equal(comparison.observedSinceAt, '2026-08-22T12:00:00.000Z');
  assert.deepEqual(comparison.totals, {
    activeRefreshCount: 1,
    cacheServedLookups: 6,
    cacheServedRatePercent: 86,
    cacheStoreErrorCount: 2,
    coldLookupRatePercent: 14,
    coldLookups: 1,
    completedRefreshCount: 3,
    freshLookups: 3,
    refreshFailureCount: 1,
    refreshFailureRatePercent: 33,
    staleLookups: 3,
    totalLookups: 7,
  });
  assert.deepEqual(comparison.namespaces, [
    {
      activeRefreshCount: 1,
      cacheNamespace: 'musicbrainz.artist_release_groups',
      cacheServedLookups: 4,
      cacheServedRatePercent: 100,
      cacheStoreErrorCount: 1,
      coldLookupRatePercent: 0,
      coldLookups: 0,
      completedRefreshCount: 1,
      freshLookups: 3,
      refreshFailureCount: 0,
      refreshFailureRatePercent: 0,
      staleLookups: 1,
      totalLookups: 4,
    },
    {
      activeRefreshCount: 0,
      cacheNamespace: 'musicbrainz.related_artists',
      cacheServedLookups: 2,
      cacheServedRatePercent: 67,
      cacheStoreErrorCount: 1,
      coldLookupRatePercent: 33,
      coldLookups: 1,
      completedRefreshCount: 2,
      freshLookups: 0,
      refreshFailureCount: 1,
      refreshFailureRatePercent: 50,
      staleLookups: 2,
      totalLookups: 3,
    },
  ]);
});

test('metadata provider cache baseline comparison rejects changed process windows and regressed counters', () => {
  const reference = createBaseline({
    namespaces: [createNamespace({
      cacheNamespace: 'musicbrainz.related_artists',
      freshLookups: 3,
    })],
  });

  assert.equal(
    buildMetadataProviderCacheBaselineComparison(reference, createBaseline({
      namespaces: reference.namespaces,
      observedSinceAt: '2026-08-22T13:00:00.000Z',
    })).code,
    'comparison_process_window_changed',
  );
  assert.equal(
    buildMetadataProviderCacheBaselineComparison(reference, createBaseline({
      namespaces: [createNamespace({
        cacheNamespace: 'musicbrainz.related_artists',
        freshLookups: 2,
      })],
    })).code,
    'comparison_counter_regressed',
  );
  assert.equal(
    buildMetadataProviderCacheBaselineComparison(reference, createBaseline({
      namespaces: reference.namespaces,
      updatedAt: '2026-08-22T11:59:59.000Z',
    })).code,
    'comparison_sample_order_invalid',
  );
});

test('metadata provider cache baseline comparison snapshots exclude unsafe namespaces and require a process boundary', () => {
  const snapshot = createMetadataProviderCacheBaselineComparisonSnapshot(createBaseline({
    namespaces: [
      createNamespace({ cacheNamespace: 'musicbrainz.related_artists', freshLookups: 2 }),
      createNamespace({ cacheNamespace: 'musicbrainz/artist=private-id', freshLookups: 99 }),
    ],
  }));

  assert.deepEqual(snapshot.namespaces.map((namespace) => namespace.cacheNamespace), ['musicbrainz.related_artists']);
  assert.equal(snapshot.totals.freshLookups, 2);
  assert.equal(createMetadataProviderCacheBaselineComparisonSnapshot(createBaseline({ observedSinceAt: 'invalid' })), null);
  assert.equal(
    buildMetadataProviderCacheBaselineComparison(null, createBaseline()).code,
    'comparison_process_window_missing',
  );
});
