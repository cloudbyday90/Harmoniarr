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

function hasCandidates(sourceArtists) {
  return Array.isArray(sourceArtists) && sourceArtists.some((artist) => (
    typeof artist?.mbid === 'string' && artist.mbid.length > 0
  ));
}

/**
 * A completed direct provider result is normalized, usable metadata even if
 * the interactive deadline subsequently stops optional fallback enrichment.
 * Empty timeout outcomes remain non-cacheable so a transient outage cannot
 * create a long-lived empty recommendation cache entry.
 */
export function shouldPersistSimilarArtists({
  directSourceArtists = [],
  responseBudgetExhausted = false,
} = {}) {
  if (!responseBudgetExhausted) {
    return true;
  }

  return directSourceArtists.some(hasCandidates);
}
