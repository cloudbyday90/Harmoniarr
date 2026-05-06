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
 * Wanted-release normalization helpers.
 *
 * Provides utilities for mapping the local `library_wanted_releases` API shape
 * (from `GET /api/v1/library/wanted-releases`) into shapes that are compatible
 * with `ReleaseCard` and `RequestButton`. Kept as pure functions for easy
 * unit testing without Vue dependencies.
 */

/**
 * Maps a wanted release item (from `fetchLibraryWantedReleases`) to a shape
 * that `ReleaseCard` understands.
 *
 * Key transformations:
 * - `id` is set to `null` — the wanted release `id` is a local DB UUID, not a
 *   MusicBrainz release MBID. Passing it to `ArtworkImage` would produce
 *   incorrect artwork URLs. Instead, `musicbrainzReleaseId` is carried through
 *   so `ReleaseCard`'s `releaseMbid` computed falls back to that field.
 * - `releaseGroupId` is derived from `musicbrainzReleaseGroupId` so the
 *   `releaseGroupMbid` computed in `ReleaseCard` resolves correctly for the
 *   CAA release-group fallback.
 * - `title` and `artistCredit` are mapped from the local field names so the
 *   release-normalization helpers (`getReleaseTitle`, `getReleaseArtistName`)
 *   work without modification.
 * - Track counts and `wantedStatus` are forwarded for display in the actions slot.
 *
 * @param {object} release - Wanted release object from the API.
 * @returns {object} ReleaseCard-compatible release object.
 */
export function normalizeWantedReleaseForCard(release) {
  if (!release) return {};
  return {
    // Explicitly null out the local DB UUID so it is never used as an artwork MBID.
    id: null,
    musicbrainzReleaseId: release.musicbrainzReleaseId ?? null,
    releaseGroupId: release.musicbrainzReleaseGroupId ?? null,

    // Title/artist fields: ReleaseCard helpers read `title` and `artistCredit`.
    title: release.releaseTitle ?? null,
    artistCredit: release.artistName ?? null,
    disambiguation: release.releaseDisambiguation ?? null,

    // Date: getReleaseYear reads `date` or `releaseDate` — map to `date` for
    // canonical form and keep `releaseDate` as a passthrough fallback.
    date: release.releaseDate ?? null,

    // Release-group primary type is surfaced in the meta line by ReleaseCard.
    releaseGroup: {
      primaryType: release.releaseGroupType ?? null,
    },

    // Wanted-specific fields forwarded for the custom actions slot.
    wantedStatus: release.wantedStatus ?? null,
    expectedTrackCount: release.expectedTrackCount ?? 0,
    matchedTrackCount: release.matchedTrackCount ?? 0,
    missingTrackCount: release.missingTrackCount ?? 0,

    // Forwarded for potential artist-detail navigation.
    metadataArtistId: release.metadataArtistId ?? null,
  };
}

/**
 * Returns the display label for a wanted status value.
 *
 * @param {string|null} status
 * @returns {string}
 */
export function getWantedStatusLabel(status) {
  if (status === 'missing') return 'Missing';
  if (status === 'partial') return 'Partial';
  return status ?? 'Unknown';
}

/**
 * Returns the design-system tone for a wanted status value.
 * Suitable for use as `data-tone` on `hx-pill`.
 *
 * @param {string|null} status
 * @returns {'danger'|'warning'|'info'}
 */
export function getWantedStatusTone(status) {
  if (status === 'missing') return 'danger';
  if (status === 'partial') return 'warning';
  return 'info';
}

/**
 * Formats the track count summary for a wanted release.
 * Returns `null` if data is insufficient to produce a useful string.
 *
 * @param {object} release - A normalized or raw wanted release object.
 * @returns {string|null}
 */
export function formatWantedTrackCounts(release) {
  if (!release) return null;
  const expected = release.expectedTrackCount ?? 0;
  const matched = release.matchedTrackCount ?? 0;
  if (expected <= 0) return null;
  if (matched === 0) return `0 / ${expected} tracks`;
  return `${matched} / ${expected} tracks`;
}
