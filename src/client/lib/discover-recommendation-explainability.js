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

import { buildRecommendationScoreBreakdown } from './discover-recommendation-scoring.js';

const RELATED_SOURCES = new Set(['musicbrainz']);
const LISTENER_SOURCES = new Set(['listenbrainz', 'lastfm']);

/**
 * Map raw engine source strings into stable explanation categories.
 *
 * @param {string} source
 * @returns {Array<'related'|'listeners'>}
 */
export function recommendationSourceCategories(source) {
  if (source === 'both') {
    return ['related', 'listeners'];
  }
  if (RELATED_SOURCES.has(source)) {
    return ['related'];
  }
  if (LISTENER_SOURCES.has(source)) {
    return ['listeners'];
  }
  return [];
}

/**
 * Build a recommendation explanation contract for UI presentation.
 *
 * Raw source names and scores remain internal. The returned labels are fixed
 * enumerations so rendering them through Vue interpolation stays injection-safe
 * and does not overstate the recommendation engine's precision.
 *
 * @param {{ score?: number, rankScore?: number, inputCount?: number, sources?: string[] }|null|undefined} suggestion
 * @returns {{
 *   provenance: { label: string, tone: string, categories: string[] },
 *   strength: { tier: 'strong'|'moderate'|'emerging', label: string },
 *   metaText: string,
 *   supportingText: string,
 *   scoreBreakdown: { baseScore: number, inputBoost: number, rankScore: number },
 * }}
 */
export function buildRecommendationExplanation(suggestion) {
  const sources = Array.isArray(suggestion?.sources) ? suggestion.sources : [];
  const categories = new Set();
  for (const source of sources) {
    for (const category of recommendationSourceCategories(source)) {
      categories.add(category);
    }
  }

  const hasRelated = categories.has('related');
  const hasListeners = categories.has('listeners');
  const inputCount = Number.isFinite(Number(suggestion?.inputCount))
    ? Math.max(0, Math.floor(Number(suggestion.inputCount)))
    : 0;
  const scoreBreakdown = buildRecommendationScoreBreakdown({
    score: suggestion?.score,
    inputCount,
  });
  const providedRankScore = Number(suggestion?.rankScore);
  const rankScore = Number.isFinite(providedRankScore)
    ? providedRankScore
    : scoreBreakdown.rankScore;
  const strength = buildRecommendationStrengthFromRank(rankScore);
  const provenance = buildRecommendationProvenanceFromCategories({ hasRelated, hasListeners });

  return {
    provenance: {
      ...provenance,
      categories: [...categories].sort(),
    },
    strength,
    metaText: buildRecommendationMetaFromInputCount(inputCount),
    supportingText: buildRecommendationSupportFromExplanation({
      hasListeners,
      hasRelated,
      inputCount,
      strengthTier: strength.tier,
    }),
    scoreBreakdown: {
      ...scoreBreakdown,
      rankScore,
    },
  };
}

function buildRecommendationProvenanceFromCategories({ hasRelated, hasListeners }) {
  if (hasRelated && hasListeners) {
    return { label: 'Related + listeners', tone: 'success' };
  }
  if (hasRelated) {
    return { label: 'Related artist', tone: 'info' };
  }
  if (hasListeners) {
    return { label: 'Listener overlap', tone: 'info' };
  }
  return { label: 'Recommended', tone: 'info' };
}

function buildRecommendationStrengthFromRank(rankScore) {
  const value = Number.isFinite(rankScore) ? rankScore : 0;

  if (value >= 1.5) {
    return { tier: 'strong', label: 'Strong overlap' };
  }
  if (value >= 0.8) {
    return { tier: 'moderate', label: 'Moderate overlap' };
  }
  return { tier: 'emerging', label: 'Emerging overlap' };
}

function buildRecommendationMetaFromInputCount(inputCount) {
  if (inputCount > 1) {
    return `Shared by ${inputCount} of your monitored artists`;
  }
  return 'From your monitored artists';
}

function buildRecommendationSupportFromExplanation({
  hasListeners,
  hasRelated,
  inputCount,
  strengthTier,
}) {
  if (inputCount > 1 && strengthTier === 'strong') {
    return 'Strong overlap across multiple monitored artists.';
  }
  if (inputCount > 1) {
    return 'Multiple monitored artists point to this recommendation.';
  }
  if (strengthTier === 'strong') {
    return 'Strong overlap with your monitored artists.';
  }
  if (hasRelated && hasListeners) {
    return 'Backed by related-artist and listener-overlap signals.';
  }
  if (hasRelated) {
    return 'Backed by related-artist signals.';
  }
  if (hasListeners) {
    return 'Backed by listener-overlap signals.';
  }
  return 'Recommended from your monitored artists.';
}
