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

import { buildFormatSearchTerm } from './format-preference-scoring.js';
import { normalizeFallbackQuery } from './library-discovery-search-query.js';

export const MAX_TRACK_FALLBACK_QUERIES = 30;
const MIN_TRACK_TITLE_LENGTH = 3;

/**
 * Returns true when a normalized track title is specific enough to search for
 * on its own without producing a flood of unrelated Soulseek responses.
 */
export function hasSafeTrackSearchShape(trackTitle) {
  const normalized = normalizeFallbackQuery(trackTitle);
  if (!normalized) {
    return false;
  }
  return normalized.length >= MIN_TRACK_TITLE_LENGTH;
}

/**
 * Builds a bounded, deduplicated list of per-track Soulseek search queries used
 * as a terminal fallback after album-level discovery attempts are exhausted with
 * zero usable candidates. Pure and side-effect free.
 *
 * Each query combines the artist name with a single track title plus an optional
 * format term, mirroring the album-level query shape so downstream scoring and
 * ingestion behave identically.
 */
export function buildPerTrackDiscoveryQueries({
  artistName,
  expectedTrackTitles,
  preferredFormat,
  maxQueries = MAX_TRACK_FALLBACK_QUERIES,
} = {}) {
  if (!Array.isArray(expectedTrackTitles) || expectedTrackTitles.length === 0) {
    return [];
  }

  const artist = normalizeFallbackQuery(artistName);
  const formatTerm = buildFormatSearchTerm(preferredFormat);
  const limit = Number.isInteger(maxQueries) && maxQueries > 0
    ? Math.min(maxQueries, MAX_TRACK_FALLBACK_QUERIES)
    : MAX_TRACK_FALLBACK_QUERIES;

  const queries = [];
  const seen = new Set();

  for (const rawTitle of expectedTrackTitles) {
    if (queries.length >= limit) {
      break;
    }
    if (!hasSafeTrackSearchShape(rawTitle)) {
      continue;
    }

    const trackTitle = normalizeFallbackQuery(rawTitle);
    const parts = [artist, trackTitle].filter(Boolean);
    if (formatTerm) {
      parts.push(formatTerm);
    }

    const query = parts.join(' ');
    if (!query) {
      continue;
    }

    const dedupeKey = query.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    queries.push({ trackTitle, query });
  }

  return queries;
}
