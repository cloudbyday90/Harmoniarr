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
import { ref } from 'vue';
import { useMetadataProviderCacheBaselineComparison } from '../../src/client/composables/useMetadataProviderCacheBaselineComparison.js';

function createBaseline(freshLookups, updatedAt) {
  return {
    namespaces: [{
      activeRefreshCount: 0,
      cacheNamespace: 'musicbrainz.artist_release_groups',
      cacheStoreErrorCount: 0,
      coldLookups: 1,
      completedRefreshCount: 1,
      freshLookups,
      refreshFailureCount: 0,
      staleLookups: 0,
    }],
    observedSinceAt: '2026-08-22T12:00:00.000Z',
    updatedAt,
  };
}

test('useMetadataProviderCacheBaselineComparison keeps an explicit start only in reactive view memory', () => {
  const cacheBaseline = ref(createBaseline(2, '2026-08-22T12:01:00.000Z'));
  const workflow = useMetadataProviderCacheBaselineComparison(cacheBaseline);

  assert.equal(workflow.hasComparisonStart.value, false);
  assert.equal(workflow.markComparisonStart(), true);
  assert.equal(workflow.hasComparisonStart.value, true);

  cacheBaseline.value = createBaseline(5, '2026-08-22T12:02:00.000Z');

  assert.equal(workflow.baselineComparison.value.canCompare, true);
  assert.equal(workflow.baselineComparison.value.totals.freshLookups, 3);

  workflow.clearComparisonStart();

  assert.equal(workflow.hasComparisonStart.value, false);
  assert.equal(workflow.baselineComparison.value.code, 'comparison_process_window_missing');
});

test('useMetadataProviderCacheBaselineComparison refuses to mark a baseline without a process boundary', () => {
  const cacheBaseline = ref({ namespaces: [], observedSinceAt: null, updatedAt: null });
  const workflow = useMetadataProviderCacheBaselineComparison(cacheBaseline);

  assert.equal(workflow.markComparisonStart(), false);
  assert.equal(workflow.hasComparisonStart.value, false);
});
