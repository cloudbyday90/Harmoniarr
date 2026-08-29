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
  appendArtistDetailCacheServerTiming,
  buildArtistDetailCacheServerTiming,
} from '../../src/server/metadata/artist-detail-cache-server-timing.js';

test('buildArtistDetailCacheServerTiming serializes a foreground cache fill with its duration', () => {
  const timing = buildArtistDetailCacheServerTiming({
    lookup: 'cold',
    refresh: 'foreground',
    refreshDurationMs: 42.6,
    state: 'fresh',
  });

  assert.equal(timing, 'harmoniarr-cache;desc="cold/foreground/fresh";dur=43');
});

test('buildArtistDetailCacheServerTiming keeps a stale background response bounded and duration-free', () => {
  const timing = buildArtistDetailCacheServerTiming({
    lookup: 'stale',
    refresh: 'background',
    refreshDurationMs: 987,
    state: 'stale',
  });

  assert.equal(timing, 'harmoniarr-cache;desc="stale/background/stale"');
});

test('buildArtistDetailCacheServerTiming rejects invalid or high-cardinality cache data', () => {
  assert.equal(buildArtistDetailCacheServerTiming(null), null);
  assert.equal(buildArtistDetailCacheServerTiming({
    lookup: 'cold\r\nX-Cache-Key: private',
    refresh: 'foreground',
    refreshDurationMs: 1,
    state: 'fresh',
  }), null);
  assert.equal(buildArtistDetailCacheServerTiming({
    lookup: 'cold',
    refresh: 'foreground',
    refreshDurationMs: Number.NaN,
    state: 'fresh',
  }), 'harmoniarr-cache;desc="cold/foreground/fresh"');
});

test('appendArtistDetailCacheServerTiming appends instead of replacing existing timing metrics', () => {
  const response = {
    appended: [],
    append(name, value) {
      this.appended.push({ name, value });
    },
  };

  const appended = appendArtistDetailCacheServerTiming(response, {
    lookup: 'fresh',
    refresh: 'none',
    state: 'fresh',
  });

  assert.equal(appended, true);
  assert.deepEqual(response.appended, [{
    name: 'Server-Timing',
    value: 'harmoniarr-cache;desc="fresh/none/fresh"',
  }]);
});
