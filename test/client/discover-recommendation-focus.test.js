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
  buildDiscoverRecommendationFocusQuery,
  DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY,
  filterInputResultsByFocus,
  filterRecommendationInputsByFocus,
  isRecommendationFocusActive,
  normalizeRecommendationFocusIds,
} from '../../src/client/lib/discover-recommendation-focus.js';

const recommendationInputs = [
  { id: 'artist-boards', name: 'Boards of Canada' },
  { id: 'artist-autechre', name: 'Autechre' },
];

test('normalizeRecommendationFocusIds trims, deduplicates, and drops empty ids', () => {
  assert.deepEqual(
    normalizeRecommendationFocusIds([' artist-boards ', '', 'artist-boards', 'artist-autechre']),
    ['artist-boards', 'artist-autechre'],
  );
});

test('normalizeRecommendationFocusIds accepts a single route-query string', () => {
  assert.deepEqual(normalizeRecommendationFocusIds(' artist-boards '), ['artist-boards']);
});

test('normalizeRecommendationFocusIds can constrain ids to available monitored artists', () => {
  assert.deepEqual(
    normalizeRecommendationFocusIds(['artist-boards', 'missing-artist'], recommendationInputs),
    ['artist-boards'],
  );
});

test('filterRecommendationInputsByFocus returns all inputs when focus is empty or invalid', () => {
  assert.deepEqual(filterRecommendationInputsByFocus(recommendationInputs, []), recommendationInputs);
  assert.deepEqual(
    filterRecommendationInputsByFocus(recommendationInputs, ['missing-artist']),
    recommendationInputs,
  );
});

test('filterRecommendationInputsByFocus returns only selected monitored artists when focus is active', () => {
  assert.deepEqual(
    filterRecommendationInputsByFocus(recommendationInputs, ['artist-autechre']),
    [{ id: 'artist-autechre', name: 'Autechre' }],
  );
});

test('filterInputResultsByFocus narrows the per-input result map when focus is active', () => {
  const inputResults = new Map([
    ['artist-boards', [{ id: 'artist-tycho', name: 'Tycho', score: 0.7 }]],
    ['artist-autechre', [{ id: 'artist-aphex', name: 'Aphex Twin', score: 0.9 }]],
  ]);

  const filtered = filterInputResultsByFocus(inputResults, ['artist-autechre'], recommendationInputs);

  assert.deepEqual([...filtered.keys()], ['artist-autechre']);
  assert.deepEqual(filtered.get('artist-autechre'), [
    { id: 'artist-aphex', name: 'Aphex Twin', score: 0.9 },
  ]);
});

test('isRecommendationFocusActive reports only valid active focus ids', () => {
  assert.equal(isRecommendationFocusActive(['artist-boards'], recommendationInputs), true);
  assert.equal(isRecommendationFocusActive(['missing-artist'], recommendationInputs), false);
  assert.equal(isRecommendationFocusActive([], recommendationInputs), false);
});

test('buildDiscoverRecommendationFocusQuery preserves unrelated query values', () => {
  assert.deepEqual(
    buildDiscoverRecommendationFocusQuery({ q: 'ambient' }, ['artist-boards']),
    {
      q: 'ambient',
      [DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY]: 'artist-boards',
    },
  );
});

test('buildDiscoverRecommendationFocusQuery stores multiple focus ids as repeated query values', () => {
  assert.deepEqual(
    buildDiscoverRecommendationFocusQuery({}, ['artist-boards', 'artist-autechre']),
    {
      [DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY]: ['artist-boards', 'artist-autechre'],
    },
  );
});

test('buildDiscoverRecommendationFocusQuery removes the focus key when no focus ids remain', () => {
  assert.deepEqual(
    buildDiscoverRecommendationFocusQuery({
      q: 'ambient',
      [DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY]: 'artist-boards',
    }, []),
    { q: 'ambient' },
  );
});
