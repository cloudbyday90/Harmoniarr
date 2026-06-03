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

/**
 * Pure functions for the Discover taste-graph traversal.
 *
 * These are extracted from the composable so they can be unit-tested with
 * the native Node test runner without requiring a Vue runtime.
 */

/**
 * Merge per-seed similarity results into a single ranked suggestion list.
 *
 * When the same artist appears in the results for multiple seeds, their scores
 * are summed and a `seedCount` tracks how many seeds recommended them. This
 * produces a natural intersection-boost: artists recommended by several of
 * your seeded artists rank higher than those recommended by only one.
 *
 * @param {Map<string, Array<{id:string, name:string, score:number}>>} seedResults
 *   Per-seed arrays of similar-artist objects. Keys are seed MBIDs, values are
 *   the arrays returned by the similarity API for that seed.
 * @param {Set<string>} excludeIds
 *   Set of artist MBIDs to exclude from the output. Typically the seed MBIDs
 *   themselves so that seeds do not appear as their own suggestions.
 * @param {number} [limit=20]
 *   Maximum number of suggestions to return, applied after sorting.
 * @returns {Array<{id:string, name:string, score:number, seedCount:number, sources:string[], rankScore:number}>}
 *   Suggestions sorted descending by ranked overlap score, capped to `limit`.
 *   `sources` is the de-duplicated, sorted set of engine sources (e.g.
 *   `'musicbrainz'`, `'listenbrainz'`, `'lastfm'`, `'both'`) that contributed
 *   the artist, preserved so the UI can show recommendation provenance.
 */
export function computeSuggestions(seedResults, excludeIds, limit = 20) {
  const tally = new Map();

  for (const [, results] of seedResults) {
    for (const { id, name, score, source } of results) {
      if (excludeIds.has(id)) continue;

      const existing = tally.get(id);
      if (existing) {
        existing.score += score;
        existing.seedCount += 1;
        if (source) existing.sources.add(source);
      } else {
        tally.set(id, { id, name, score, seedCount: 1, sources: new Set(source ? [source] : []) });
      }
    }
  }

  return [...tally.values()]
    .map((artist) => ({
      ...artist,
      sources: [...artist.sources].sort(),
      rankScore: artist.score + Math.min(0.45, Math.max(0, artist.seedCount - 1) * 0.18),
    }))
    .sort((a, b) => (
      b.rankScore - a.rankScore
      || b.seedCount - a.seedCount
      || b.score - a.score
      || a.name.localeCompare(b.name)
    ))
    .slice(0, limit);
}
