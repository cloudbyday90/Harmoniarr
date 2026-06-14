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

export const MULTI_INPUT_BOOST_STEP = 0.18;
export const MAX_MULTI_INPUT_BOOST = 0.45;

/**
 * Bounded boost for artists supported by more than one monitored artist.
 *
 * The raw source score remains the dominant ranking parameter. This boost is
 * intentionally modest so one high-confidence source match can still outrank a
 * weak shared match, while repeated monitored-artist support can break close
 * calls in a transparent way.
 *
 * @param {number} inputCount
 * @returns {number}
 */
export function computeRecommendationInputBoost(inputCount) {
  const count = Number(inputCount);
  if (!Number.isFinite(count) || count <= 1) {
    return 0;
  }

  return Math.min(MAX_MULTI_INPUT_BOOST, (Math.floor(count) - 1) * MULTI_INPUT_BOOST_STEP);
}

/**
 * Ranked score used for sorting Discover recommendations.
 *
 * @param {object} suggestion
 * @param {number} suggestion.score
 * @param {number} suggestion.inputCount
 * @returns {number}
 */
export function computeRecommendationRankScore({ score = 0, inputCount = 1 } = {}) {
  const baseScore = Number(score);
  const safeBaseScore = Number.isFinite(baseScore) ? baseScore : 0;
  return safeBaseScore + computeRecommendationInputBoost(inputCount);
}

/**
 * Stable score breakdown attached to recommendation candidates.
 *
 * This is intended for tests and explanation helpers. UI copy should bucket
 * these values rather than rendering raw numeric scores directly.
 *
 * @param {object} suggestion
 * @param {number} suggestion.score
 * @param {number} suggestion.inputCount
 * @returns {{ baseScore: number, inputBoost: number, rankScore: number }}
 */
export function buildRecommendationScoreBreakdown({ score = 0, inputCount = 1 } = {}) {
  const baseScore = Number(score);
  const safeBaseScore = Number.isFinite(baseScore) ? baseScore : 0;
  const inputBoost = computeRecommendationInputBoost(inputCount);

  return {
    baseScore: safeBaseScore,
    inputBoost,
    rankScore: safeBaseScore + inputBoost,
  };
}
