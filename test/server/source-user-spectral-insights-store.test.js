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
import { createSourceUserSpectralInsightsStore } from '../../src/server/activity/source-user-spectral-insights-store.js';

const RETROACTIVE_USERNAME = '__retroactive_library_scan__';

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ text, params });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('listRecentSpectralMeasurements maps the retroactive sentinel username to null and clamps limit', async () => {
  const pool = createFakePool(() => ({
    rows: [
      { content_hash: 'h1', username: 'alice', cutoff_hz: '19500', sample_rate: '44100', declared_codec: 'flac', declared_extension: '.flac' },
      { content_hash: 'h2', username: RETROACTIVE_USERNAME, cutoff_hz: '21000', sample_rate: '44100', declared_codec: null, declared_extension: '.flac' },
    ],
  }));
  const store = createSourceUserSpectralInsightsStore({ getPoolFn: pool.getPoolFn });

  const rows = await store.listRecentSpectralMeasurements({ limit: 999999 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].username, 'alice');
  assert.equal(rows[1].username, null);
  assert.equal(rows[0].cutoffHz, 19500);
  // Limit clamps to the 5000 max.
  assert.equal(pool.calls[0].params[0], 5000);
});

test('listRecentSpectralMeasurements falls back to the default limit on invalid input', async () => {
  const pool = createFakePool(() => ({ rows: [] }));
  const store = createSourceUserSpectralInsightsStore({ getPoolFn: pool.getPoolFn });
  await store.listRecentSpectralMeasurements({ limit: -1 });
  assert.equal(pool.calls[0].params[0], 500);
});

test('getFidelityHealthAggregates composes the four parameterized reads', async () => {
  const pool = createFakePool((text) => {
    if (text.includes('GROUP BY verdict')) {
      return { rows: [{ verdict: 'authentic', measurement_count: 3 }, { verdict: 'transcoded', measurement_count: 1 }] };
    }
    if (text.includes("COALESCE(declared_codec")) {
      return { rows: [{ codec: 'flac', measurement_count: 4, transcoded_count: 1, suspicious_count: 0, authentic_count: 3 }] };
    }
    if (text.includes('HAVING')) {
      return { rows: [{ username: 'carol', measurement_count: 2, transcoded_count: 2 }] };
    }
    if (text.includes('DATE_TRUNC')) {
      return { rows: [{ day: '2026-05-01', measurement_count: 4, transcoded_count: 1, suspicious_count: 0 }] };
    }
    return { rows: [] };
  });
  const store = createSourceUserSpectralInsightsStore({ getPoolFn: pool.getPoolFn });

  const aggregates = await store.getFidelityHealthAggregates({ trendDays: 9999, worstOffenderLimit: 9999 });
  assert.equal(aggregates.verdictDistribution.length, 2);
  assert.equal(aggregates.codecBreakdown[0].codec, 'flac');
  assert.equal(aggregates.worstOffenders[0].username, 'carol');
  assert.equal(aggregates.worstOffenders[0].transcodeRate, 1);
  assert.equal(aggregates.dailyTrend[0].day, '2026-05-01');

  // Worst-offenders query excludes the retroactive sentinel and clamps the limit.
  const worstCall = pool.calls.find((call) => call.text.includes('HAVING'));
  assert.equal(worstCall.params[0], RETROACTIVE_USERNAME);
  assert.equal(worstCall.params[1], 100);
  // Trend window clamps to the 365-day max.
  const trendCall = pool.calls.find((call) => call.text.includes('DATE_TRUNC'));
  assert.equal(trendCall.params[0], 365);
});
