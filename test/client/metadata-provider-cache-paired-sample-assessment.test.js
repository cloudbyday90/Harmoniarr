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
  assessMetadataProviderCachePairedSample,
} from '../../src/client/lib/metadata-provider-cache-paired-sample-assessment.js';

function createComparison(totals = {}) {
  return {
    canCompare: true,
    totals: {
      activeRefreshCount: 0,
      cacheStoreErrorCount: 0,
      coldLookups: 0,
      completedRefreshCount: 0,
      freshLookups: 0,
      refreshFailureCount: 0,
      staleLookups: 0,
      ...totals,
    },
  };
}

function assertAssessment(comparison, { code, title, tone }) {
  const assessment = assessMetadataProviderCachePairedSample(comparison);
  assert.equal(assessment.code, code);
  assert.equal(assessment.title, title);
  assert.equal(assessment.tone, tone);
  assert.equal(typeof assessment.summary, 'string');
  assert.equal(typeof assessment.nextAction, 'string');
}

test('assesses cache errors, failed refreshes, and active refreshes before cache-read outcomes', () => {
  assertAssessment(createComparison({
    cacheStoreErrorCount: 1,
    coldLookups: 2,
    freshLookups: 2,
  }), {
    code: 'cache_store_errors_observed',
    title: 'Cache-store errors observed',
    tone: 'danger',
  });
  assertAssessment(createComparison({ refreshFailureCount: 1, staleLookups: 2 }), {
    code: 'refresh_failures_observed',
    title: 'Refresh failures observed',
    tone: 'warning',
  });
  assertAssessment(createComparison({ activeRefreshCount: 1, staleLookups: 2 }), {
    code: 'refresh_in_progress',
    title: 'Refresh in progress',
    tone: 'info',
  });
});

test('assesses no activity, fresh reuse, stale reuse, a cold fill with reuse, and foreground-only reads', () => {
  assertAssessment(createComparison(), {
    code: 'no_cache_activity',
    title: 'No cache activity observed',
    tone: 'info',
  });
  assertAssessment(createComparison({ freshLookups: 2 }), {
    code: 'fresh_reuse_observed',
    title: 'Fresh cache reuse observed',
    tone: 'success',
  });
  assertAssessment(createComparison({ freshLookups: 1, staleLookups: 1 }), {
    code: 'stale_reuse_observed',
    title: 'Stale cache reuse observed',
    tone: 'info',
  });
  assertAssessment(createComparison({ coldLookups: 1, freshLookups: 1 }), {
    code: 'cold_then_cache_reuse_observed',
    title: 'Cold fill and cache reuse observed',
    tone: 'success',
  });
  assertAssessment(createComparison({ coldLookups: 1 }), {
    code: 'foreground_loads_observed',
    title: 'Foreground loads observed',
    tone: 'info',
  });
});

test('rejects unavailable, malformed, and unsafe aggregate input without retaining unrelated fields', () => {
  assertAssessment(null, {
    code: 'comparison_unavailable',
    title: 'Pair cannot be compared',
    tone: 'warning',
  });
  assertAssessment(createComparison({ coldLookups: -1 }), {
    code: 'comparison_unavailable',
    title: 'Pair cannot be compared',
    tone: 'warning',
  });

  const assessment = assessMetadataProviderCachePairedSample({
    ...createComparison({ freshLookups: 1 }),
    providerUrl: 'https://private.example.test/artist/secret',
    totals: {
      ...createComparison({ freshLookups: 1 }).totals,
      credential: 'secret-token',
    },
  });

  assert.equal(assessment.code, 'fresh_reuse_observed');
  assert.equal(JSON.stringify(assessment).includes('secret-token'), false);
  assert.equal(JSON.stringify(assessment).includes('private.example.test'), false);
});
