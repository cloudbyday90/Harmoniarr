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
import { createSourceUserSpectralCacheStore } from '../../src/server/activity/source-user-spectral-cache-store.js';

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ params, text });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('getCachedMeasurement returns null for blank hash without querying', async () => {
  const pool = createFakePool();
  const store = createSourceUserSpectralCacheStore({ getPoolFn: pool.getPoolFn });
  const result = await store.getCachedMeasurement({ contentHash: '   ' });
  assert.equal(result, null);
  assert.equal(pool.calls.length, 0);
});

test('getCachedMeasurement maps a row and normalizes the hash to lowercase', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      content_hash: 'abc123',
      cutoff_hz: 16000,
      frame_count: 120,
      duration_ms: 240000,
      analyzed_at: new Date('2026-01-01T00:00:00.000Z'),
    }],
    rowCount: 1,
  }));
  const store = createSourceUserSpectralCacheStore({ getPoolFn: pool.getPoolFn });

  const result = await store.getCachedMeasurement({ contentHash: '  ABC123  ' });

  assert.equal(pool.calls[0].params[0], 'abc123');
  assert.equal(result.cutoffHz, 16000);
  assert.equal(result.frameCount, 120);
  assert.equal(result.analyzedAt, '2026-01-01T00:00:00.000Z');
});

test('putCachedMeasurement upserts via ON CONFLICT and returns the row', async () => {
  const pool = createFakePool(() => ({
    rows: [{ content_hash: 'd1', cutoff_hz: 15000, frame_count: 10, duration_ms: null, analyzed_at: null }],
    rowCount: 1,
  }));
  const store = createSourceUserSpectralCacheStore({ getPoolFn: pool.getPoolFn });

  const result = await store.putCachedMeasurement({ contentHash: 'D1', cutoffHz: 15000, frameCount: 10 });

  assert.match(pool.calls[0].text, /ON CONFLICT \(content_hash\) DO UPDATE/);
  assert.equal(pool.calls[0].params[0], 'd1');
  assert.equal(result.cutoffHz, 15000);
});

test('putCachedMeasurement returns null for a blank hash', async () => {
  const pool = createFakePool();
  const store = createSourceUserSpectralCacheStore({ getPoolFn: pool.getPoolFn });
  const result = await store.putCachedMeasurement({ contentHash: '' });
  assert.equal(result, null);
  assert.equal(pool.calls.length, 0);
});
