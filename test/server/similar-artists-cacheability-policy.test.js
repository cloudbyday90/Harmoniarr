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
import { shouldPersistSimilarArtists } from '../../src/server/metadata/similar-artists-cacheability-policy.js';

test('similar artists cacheability preserves a completed direct provider result after deadline exhaustion', () => {
  assert.equal(shouldPersistSimilarArtists({
    directSourceArtists: [[{ mbid: 'artist-1', name: 'Artist', score: 0.8 }], [], []],
    responseBudgetExhausted: true,
  }), true);
});

test('similar artists cacheability rejects an empty deadline-exhausted outcome', () => {
  assert.equal(shouldPersistSimilarArtists({
    directSourceArtists: [[], [], []],
    responseBudgetExhausted: true,
  }), false);
});

test('similar artists cacheability permits complete empty provider responses', () => {
  assert.equal(shouldPersistSimilarArtists({
    directSourceArtists: [[], [], []],
    responseBudgetExhausted: false,
  }), true);
});
