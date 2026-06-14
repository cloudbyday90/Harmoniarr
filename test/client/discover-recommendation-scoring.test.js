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
  MAX_MULTI_INPUT_BOOST,
  MULTI_INPUT_BOOST_STEP,
  buildRecommendationScoreBreakdown,
  computeRecommendationInputBoost,
  computeRecommendationRankScore,
} from '../../src/client/lib/discover-recommendation-scoring.js';

test('computeRecommendationInputBoost returns 0 for a single recommendation input', () => {
  assert.equal(computeRecommendationInputBoost(1), 0);
});

test('computeRecommendationInputBoost increases by the configured step for shared support', () => {
  assert.equal(computeRecommendationInputBoost(2), MULTI_INPUT_BOOST_STEP);
});

test('computeRecommendationInputBoost is capped', () => {
  assert.equal(computeRecommendationInputBoost(99), MAX_MULTI_INPUT_BOOST);
});

test('computeRecommendationRankScore keeps base score dominant with bounded boost', () => {
  assert.equal(
    computeRecommendationRankScore({ score: 0.8, inputCount: 3 }),
    0.8 + (MULTI_INPUT_BOOST_STEP * 2),
  );
});

test('buildRecommendationScoreBreakdown returns base score, input boost, and rank score', () => {
  assert.deepEqual(buildRecommendationScoreBreakdown({ score: 1, inputCount: 2 }), {
    baseScore: 1,
    inputBoost: MULTI_INPUT_BOOST_STEP,
    rankScore: 1 + MULTI_INPUT_BOOST_STEP,
  });
});

test('buildRecommendationScoreBreakdown normalizes non-finite base scores', () => {
  assert.equal(buildRecommendationScoreBreakdown({ score: Number.NaN, inputCount: 2 }).baseScore, 0);
});
