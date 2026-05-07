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
 * Release-radar normalization helpers.
 *
 * Maps the `GET /api/v1/library/release-radar` shape (release groups from
 * monitored artists) to shapes compatible with `ReleaseCard`. Kept as pure
 * functions for unit testing without Vue dependencies.
 *
 * Release-radar items are release **groups**, not individual releases, so:
 * - `id` is set to `null` — no MusicBrainz release MBID exists here.
 * - `releaseGroupId` is derived from `musicbrainzReleaseGroupId` for CAA
 *   artwork lookups via the release-group endpoint.
 * - `musicbrainzReleaseId` is `null` — unused, no individual release in scope.
 */

/**
 * Maps a single release-radar item (from `buildReleaseRadar` / `fetchReleaseRadar`)
 * to a shape that `ReleaseCard` understands.
 *
 * @param {object} radarItem - Radar release group item from the API.
 * @returns {object} ReleaseCard-compatible release object.
 */
export function normalizeRadarReleaseForCard(radarItem) {
  if (!radarItem) return {};
  return {
    // Explicitly null — no individual release MBID at the release-group level.
    id: null,
    musicbrainzReleaseId: null,
    releaseGroupId: radarItem.musicbrainzReleaseGroupId ?? null,

    // Title/artist fields: ReleaseCard helpers read `title` and `artistCredit`.
    title: radarItem.releaseGroupTitle ?? null,
    artistCredit: radarItem.artistName ?? null,

    // Date: getReleaseYear reads `date`.
    date: radarItem.firstReleaseDate ?? null,

    // Release-group primary type is surfaced in the meta line by ReleaseCard.
    releaseGroup: {
      primaryType: radarItem.releaseGroupType ?? null,
    },

    // Forwarded for potential artist-detail navigation.
    metadataArtistId: radarItem.metadataArtistId ?? null,
    metadataReleaseGroupId: radarItem.metadataReleaseGroupId ?? null,
    musicbrainzArtistId: radarItem.musicbrainzArtistId ?? null,
  };
}

/**
 * Returns a human-readable label for a radar time window.
 *
 * @param {'recent'|'upcoming'} kind
 * @param {number} days
 * @returns {string}
 */
export function getRadarWindowLabel(kind, days) {
  if (kind === 'upcoming') {
    if (days <= 7) return 'Coming this week';
    if (days <= 30) return 'Coming this month';
    if (days <= 90) return 'Coming soon';
    return `Coming in the next ${days} days`;
  }
  // 'recent'
  if (days <= 7) return 'New this week';
  if (days <= 30) return 'New this month';
  return `New in the last ${days} days`;
}
