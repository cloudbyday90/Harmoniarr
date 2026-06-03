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
  MAX_TRACK_FALLBACK_QUERIES,
  buildPerTrackDiscoveryQueries,
  hasSafeTrackSearchShape,
} from '../../src/server/library/library-discovery-track-fallback-query.js';

test('hasSafeTrackSearchShape rejects empty or trivially short titles', () => {
  assert.equal(hasSafeTrackSearchShape('Windowlicker'), true);
  assert.equal(hasSafeTrackSearchShape('  Avril 14th  '), true);
  assert.equal(hasSafeTrackSearchShape('ab'), false);
  assert.equal(hasSafeTrackSearchShape(''), false);
  assert.equal(hasSafeTrackSearchShape(null), false);
});

test('buildPerTrackDiscoveryQueries combines artist, track, and format term', () => {
  const queries = buildPerTrackDiscoveryQueries({
    artistName: 'Aphex Twin',
    expectedTrackTitles: ['Windowlicker', 'Come To Daddy'],
    preferredFormat: 'flac',
  });
  assert.deepEqual(queries, [
    { trackTitle: 'Windowlicker', query: 'Aphex Twin Windowlicker FLAC' },
    { trackTitle: 'Come To Daddy', query: 'Aphex Twin Come To Daddy FLAC' },
  ]);
});

test('buildPerTrackDiscoveryQueries omits format term for any/null preference', () => {
  const queries = buildPerTrackDiscoveryQueries({
    artistName: 'Boards of Canada',
    expectedTrackTitles: ['Roygbiv'],
    preferredFormat: 'any',
  });
  assert.deepEqual(queries, [
    { trackTitle: 'Roygbiv', query: 'Boards of Canada Roygbiv' },
  ]);
});

test('buildPerTrackDiscoveryQueries normalizes punctuation and diacritics', () => {
  const queries = buildPerTrackDiscoveryQueries({
    artistName: 'Sigur Rós',
    expectedTrackTitles: ['Glósóli!'],
    preferredFormat: null,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].query, 'Sigur Ros Glosoli');
});

test('buildPerTrackDiscoveryQueries deduplicates and skips unsafe titles', () => {
  const queries = buildPerTrackDiscoveryQueries({
    artistName: 'Artist',
    expectedTrackTitles: ['Track One', 'track one', 'ok', '', null, 'Track Two'],
    preferredFormat: null,
  });
  assert.deepEqual(queries.map((entry) => entry.query), [
    'Artist Track One',
    'Artist Track Two',
  ]);
});

test('buildPerTrackDiscoveryQueries bounds the number of generated queries', () => {
  const titles = Array.from({ length: MAX_TRACK_FALLBACK_QUERIES + 10 }, (_value, index) => `Track Number ${index}`);
  const queries = buildPerTrackDiscoveryQueries({
    artistName: 'Artist',
    expectedTrackTitles: titles,
    preferredFormat: null,
    maxQueries: 5,
  });
  assert.equal(queries.length, 5);
});

test('buildPerTrackDiscoveryQueries returns empty for missing track titles', () => {
  assert.deepEqual(buildPerTrackDiscoveryQueries({ artistName: 'Artist', expectedTrackTitles: null }), []);
  assert.deepEqual(buildPerTrackDiscoveryQueries({ artistName: 'Artist', expectedTrackTitles: [] }), []);
  assert.deepEqual(buildPerTrackDiscoveryQueries({}), []);
});
