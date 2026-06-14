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
  buildRecommendationExplanation,
  recommendationSourceCategories,
} from '../../src/client/lib/discover-recommendation-explainability.js';

test('recommendationSourceCategories maps relationship data to related', () => {
  assert.deepEqual(recommendationSourceCategories('musicbrainz'), ['related']);
});

test('recommendationSourceCategories maps listener data to listeners', () => {
  assert.deepEqual(recommendationSourceCategories('listenbrainz'), ['listeners']);
  assert.deepEqual(recommendationSourceCategories('lastfm'), ['listeners']);
});

test('recommendationSourceCategories maps combined source to both stable categories', () => {
  assert.deepEqual(recommendationSourceCategories('both'), ['related', 'listeners']);
});

test('buildRecommendationExplanation produces a combined provenance badge', () => {
  const explanation = buildRecommendationExplanation({
    inputCount: 2,
    score: 1,
    sources: ['musicbrainz', 'listenbrainz'],
  });

  assert.deepEqual(explanation.provenance, {
    categories: ['listeners', 'related'],
    label: 'Related + listeners',
    tone: 'success',
  });
});

test('buildRecommendationExplanation buckets strength without exposing raw scores in copy', () => {
  const explanation = buildRecommendationExplanation({
    inputCount: 1,
    score: 2,
    sources: ['musicbrainz'],
  });

  assert.deepEqual(explanation.strength, { tier: 'strong', label: 'Strong overlap' });
  assert.doesNotMatch(explanation.supportingText, /\b2(?:\.0+)?\b/);
});

test('buildRecommendationExplanation explains multi-input support', () => {
  const explanation = buildRecommendationExplanation({
    inputCount: 3,
    score: 0.7,
    sources: ['mystery'],
  });

  assert.equal(explanation.metaText, 'Shared by 3 of your monitored artists');
  assert.equal(explanation.supportingText, 'Multiple monitored artists point to this recommendation.');
});

test('buildRecommendationExplanation preserves an explicit rankScore for legacy callers', () => {
  const explanation = buildRecommendationExplanation({
    inputCount: 1,
    rankScore: 1.5,
    score: 0.1,
    sources: [],
  });

  assert.equal(explanation.strength.tier, 'strong');
  assert.equal(explanation.scoreBreakdown.rankScore, 1.5);
});

test('buildRecommendationExplanation returns fixed labels for untrusted sources', () => {
  const explanation = buildRecommendationExplanation({
    inputCount: 1,
    score: 0.4,
    sources: ['<img src=x onerror=alert(1)>'],
  });

  assert.equal(explanation.provenance.label, 'Recommended');
  assert.ok(!/[<>]/.test(explanation.supportingText));
});
