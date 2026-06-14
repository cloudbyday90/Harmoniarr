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

import {
  buildRecommendationScoreBreakdown,
} from './discover-recommendation-scoring.js';

/**
 * Pure functions for the Discover recommendation traversal.
 *
 * These are extracted from the composable so they can be unit-tested with
 * the native Node test runner without requiring a Vue runtime.
 */

/**
 * Merge per-input similarity results into a single ranked suggestion list.
 *
 * When the same artist appears in the results for multiple recommendation
 * inputs, their scores are summed and an `inputCount` tracks how many inputs
 * recommended them. This produces a natural intersection boost: artists
 * recommended by several monitored artists rank higher than those recommended
 * by only one.
 *
 * @param {Map<string, Array<{id:string, name:string, score:number}>>} inputResults
 *   Per-input arrays of similar-artist objects. Keys are input MBIDs, values
 *   are the arrays returned by the similarity API for that input.
 * @param {Set<string>} excludeIds
 *   Set of artist MBIDs to exclude from the output. Typically the monitored
 *   input MBIDs themselves so they do not appear as their own suggestions.
 * @param {number} [limit=20]
 *   Maximum number of suggestions to return, applied after sorting.
 * @returns {Array<{id:string, name:string, score:number, inputCount:number, inputBoost:number, sources:string[], rankScore:number}>}
 *   Suggestions sorted descending by ranked overlap score, capped to `limit`.
 *   `sources` is the de-duplicated, sorted set of engine sources (e.g.
 *   `'musicbrainz'`, `'listenbrainz'`, `'lastfm'`, `'both'`) that contributed
 *   the artist, preserved so the UI can show recommendation provenance.
 */
export function computeSuggestions(inputResults, excludeIds, limit = 20) {
  const tally = new Map();

  for (const [, results] of inputResults) {
    for (const { id, name, score, source } of results) {
      if (excludeIds.has(id)) continue;

      const existing = tally.get(id);
      if (existing) {
        existing.score += score;
        existing.inputCount += 1;
        if (source) existing.sources.add(source);
      } else {
        tally.set(id, { id, name, score, inputCount: 1, sources: new Set(source ? [source] : []) });
      }
    }
  }

  return [...tally.values()]
    .map((artist) => {
      const scoreBreakdown = buildRecommendationScoreBreakdown(artist);
      return {
        ...artist,
        inputBoost: scoreBreakdown.inputBoost,
        sources: [...artist.sources].sort(),
        rankScore: scoreBreakdown.rankScore,
      };
    })
    .sort((a, b) => (
      b.rankScore - a.rankScore
      || b.inputCount - a.inputCount
      || b.score - a.score
      || a.name.localeCompare(b.name)
    ))
    .slice(0, limit);
}
