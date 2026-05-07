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
  selectCanonicalRelease,
  forceCanonicalRelease,
  markCanonicalRelease,
} from '../../../src/server/metadata/canonical-release-service.js';

// ── selectCanonicalRelease ────────────────────────────────────────────────────

test('selectCanonicalRelease returns null for empty input', () => {
  assert.equal(selectCanonicalRelease([]), null);
});

test('selectCanonicalRelease returns the only row when one row is provided', () => {
  const row = { id: 'r1', status: 'Official', track_count: 10 };
  assert.equal(selectCanonicalRelease([row]), row);
});

test('selectCanonicalRelease step 1: prefers Official releases over Promotional', () => {
  const promotional = { id: 'promo', status: 'Promotional', track_count: 10, release_date: '2000-01-01', created_at: '2000-01-01' };
  const official = { id: 'off', status: 'Official', track_count: 10, release_date: '2000-01-01', created_at: '2000-01-01' };
  const result = selectCanonicalRelease([promotional, official]);
  assert.equal(result.id, 'off');
});

test('selectCanonicalRelease step 1: uses all rows when none are Official', () => {
  const bootleg = { id: 'b1', status: 'Bootleg', track_count: 8, release_date: '2000-01-01', created_at: '2000-01-01' };
  const promo = { id: 'p1', status: 'Promotional', track_count: 8, release_date: '2001-01-01', created_at: '2000-01-01' };
  const result = selectCanonicalRelease([bootleg, promo]);
  assert.equal(result.id, 'b1');
});

test('selectCanonicalRelease step 2: excludes deluxe editions with track_count > 1.5x median', () => {
  const standard = { id: 'std', status: 'Official', track_count: 10, release_date: '2000-01-01', created_at: '2000-01-01' };
  const deluxe = { id: 'dlx', status: 'Official', track_count: 20, release_date: '2000-01-01', created_at: '2000-01-01' };
  const result = selectCanonicalRelease([standard, deluxe]);
  assert.equal(result.id, 'std');
});

test('selectCanonicalRelease step 2: keeps all when track_count would reduce to empty set', () => {
  // All tracks equally over threshold - fallback to candidates
  const a = { id: 'a', status: 'Official', track_count: 0, release_date: '2001-01-01', created_at: '2001-01-01' };
  const b = { id: 'b', status: 'Official', track_count: 0, release_date: '2000-01-01', created_at: '2000-01-01' };
  const result = selectCanonicalRelease([a, b]);
  // med = 0, so threshold 0, filter skipped — picks earliest date
  assert.equal(result.id, 'b');
});

test('selectCanonicalRelease step 3: prefers earliest release_date', () => {
  const older = { id: 'old', status: 'Official', track_count: 10, release_date: '1998-06-01', created_at: '2020-01-01' };
  const newer = { id: 'new', status: 'Official', track_count: 10, release_date: '2005-09-15', created_at: '2020-01-01' };
  const result = selectCanonicalRelease([newer, older]);
  assert.equal(result.id, 'old');
});

test('selectCanonicalRelease step 3: nulls last for release_date', () => {
  const dateless = { id: 'nd', status: 'Official', track_count: 10, release_date: null, created_at: '2020-01-01' };
  const dated = { id: 'd', status: 'Official', track_count: 10, release_date: '2000-01-01', created_at: '2020-01-01' };
  const result = selectCanonicalRelease([dateless, dated]);
  assert.equal(result.id, 'd');
});

test('selectCanonicalRelease step 4: tie-breaks by country (XW > GB > US)', () => {
  const us = { id: 'us', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'US', created_at: '2020-01-01' };
  const gb = { id: 'gb', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'GB', created_at: '2020-01-01' };
  const xw = { id: 'xw', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'XW', created_at: '2020-01-01' };
  assert.equal(selectCanonicalRelease([us, gb, xw]).id, 'xw');
  assert.equal(selectCanonicalRelease([us, gb]).id, 'gb');
});

test('selectCanonicalRelease step 4: unknown country loses to preferred countries', () => {
  const de = { id: 'de', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'DE', created_at: '2020-01-01' };
  const xw = { id: 'xw', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'XW', created_at: '2020-01-01' };
  assert.equal(selectCanonicalRelease([de, xw]).id, 'xw');
});

test('selectCanonicalRelease step 5: tie-breaks by lowest created_at', () => {
  const newer = { id: 'newer', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'US', created_at: '2022-01-02' };
  const older = { id: 'older', status: 'Official', track_count: 10, release_date: '2000-01-01', country: 'US', created_at: '2022-01-01' };
  assert.equal(selectCanonicalRelease([newer, older]).id, 'older');
});

// ── forceCanonicalRelease ─────────────────────────────────────────────────────

test('forceCanonicalRelease returns null when release is not found', async () => {
  const queryResults = [{ rows: [] }];
  let callIndex = 0;
  const pool = {
    query: async () => queryResults[callIndex++],
  };
  const result = await forceCanonicalRelease('nonexistent-id', { getPoolFn: async () => pool });
  assert.equal(result, null);
});

test('forceCanonicalRelease clears old canonical and sets new one, returning releaseGroupId', async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql: sql.trim(), params });
      if (queries.length === 1) {
        return { rows: [{ metadata_release_group_id: 'rg-42' }] };
      }
      return { rows: [] };
    },
  };
  const result = await forceCanonicalRelease('release-7', { getPoolFn: async () => pool });

  assert.deepEqual(result, { releaseGroupId: 'rg-42' });
  assert.equal(queries.length, 3);
  assert.match(queries[0].sql, /SELECT.*metadata_release_group_id.*metadata_releases/s);
  assert.match(queries[1].sql, /UPDATE metadata_releases SET is_canonical = FALSE/);
  assert.deepEqual(queries[1].params, ['rg-42']);
  assert.match(queries[2].sql, /UPDATE metadata_releases SET is_canonical = TRUE/);
  assert.deepEqual(queries[2].params, ['release-7']);
});

// ── markCanonicalRelease ──────────────────────────────────────────────────────

test('markCanonicalRelease is a no-op when release group has no releases', async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  await markCanonicalRelease('rg-empty', { getPoolFn: async () => pool });
  // Only the SELECT should be issued, no UPDATEs
  assert.equal(queries.length, 1);
});

test('markCanonicalRelease runs two UPDATEs to persist the selected canonical', async () => {
  const releaseRows = [
    { id: 'r1', status: 'Official', track_count: 10, release_date: '2000-01-01', is_canonical: true, created_at: '2020-01-01', country: 'US' },
    { id: 'r2', status: 'Official', track_count: 10, release_date: '1998-05-01', is_canonical: false, created_at: '2020-01-01', country: 'US' },
  ];
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql: sql.trim(), params });
      if (queries.length === 1) return { rows: releaseRows };
      return { rows: [] };
    },
  };
  await markCanonicalRelease('rg-1', { getPoolFn: async () => pool });

  assert.equal(queries.length, 3);
  assert.match(queries[1].sql, /UPDATE metadata_releases SET is_canonical = FALSE/);
  assert.match(queries[2].sql, /UPDATE metadata_releases SET is_canonical = TRUE/);
  // r2 has earlier release_date so it should win
  assert.deepEqual(queries[2].params, ['r2']);
});
