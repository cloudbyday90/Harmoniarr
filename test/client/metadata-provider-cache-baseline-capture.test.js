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
import { formatMetadataProviderCacheBaselineCapture } from '../../src/client/lib/metadata-provider-cache-baseline-capture.js';
import { writePlainTextToClipboard } from '../../src/client/lib/plain-text-clipboard-service.js';

test('metadata provider cache baseline capture formats only safe, process-local values', () => {
  const capture = formatMetadataProviderCacheBaselineCapture({
    namespaces: [{
      activeRefreshCount: 1,
      cacheNamespace: 'musicbrainz.related_artists',
      cacheServedRatePercent: 80,
      cacheStoreErrorCount: 1,
      coldLookups: 2,
      completedRefreshCount: 4,
      freshLookups: 5,
      lastRefreshAt: '2026-08-22T12:03:00.000Z',
      refreshFailureCount: 1,
      staleLookups: 3,
    }],
    observedSinceAt: '2026-08-22T12:00:00.000Z',
    totals: {
      activeRefreshCount: 1,
      cacheServedLookups: 8,
      cacheServedRatePercent: 80,
      cacheStoreErrorCount: 1,
      coldLookupRatePercent: 20,
      coldLookups: 2,
      completedRefreshCount: 4,
      refreshFailureCount: 1,
      totalLookups: 10,
    },
    updatedAt: '2026-08-22T12:04:00.000Z',
  });

  assert.match(capture, /^Harmoniarr Artist Detail cache baseline/m);
  assert.match(capture, /Scope: process-local aggregate; not fleet telemetry\./);
  assert.match(capture, /Observed since \(UTC\): 2026-08-22 12:00:00 UTC/);
  assert.match(capture, /Totals: 8 cache-served of 10 lookups \(80%\); 2 cold \(20%\); 4 completed refreshes \/ 1 failed \/ 1 active; 1 cache-store errors\./);
  assert.match(capture, /musicbrainz\.related_artists: lookups 5 fresh \/ 3 stale \/ 2 cold/);
  assert.match(capture, /latest refresh 2026-08-22 12:03:00 UTC/);
});

test('metadata provider cache baseline capture drops unsafe namespaces and malformed values', () => {
  const capture = formatMetadataProviderCacheBaselineCapture({
    namespaces: [
      { cacheNamespace: 'provider/artist=private-id', freshLookups: 99 },
      {
        cacheNamespace: 'musicbrainz.artist_release_groups',
        cacheServedRatePercent: 101,
        coldLookups: -1,
        freshLookups: '2',
        lastRefreshAt: 'not-a-date',
      },
    ],
    observedSinceAt: 'invalid',
    totals: { cacheServedLookups: -1, totalLookups: '2' },
  });

  assert.doesNotMatch(capture, /private-id/);
  assert.match(capture, /Observed since \(UTC\): Not recorded/);
  assert.match(capture, /Totals: 0 cache-served of 0 lookups \(No samples\)/);
  assert.match(capture, /musicbrainz\.artist_release_groups: lookups 0 fresh \/ 0 stale \/ 0 cold; cache served No samples/);
});

test('writePlainTextToClipboard writes non-empty plain text without a read fallback', async (t) => {
  const writeText = t.mock.fn(async () => {});

  await writePlainTextToClipboard('safe baseline', { clipboard: { writeText } });

  assert.equal(writeText.mock.callCount(), 1);
  assert.equal(writeText.mock.calls[0].arguments[0], 'safe baseline');
  await assert.rejects(() => writePlainTextToClipboard(''), /non-empty string/);
  await assert.rejects(() => writePlainTextToClipboard('safe baseline', { clipboard: {} }), /unavailable/);
});
