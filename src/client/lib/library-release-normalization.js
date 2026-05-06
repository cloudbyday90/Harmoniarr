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
 * Library-release normalization helpers.
 *
 * Provides utilities for mapping the local `library_release_reconciliations`
 * API shape (from `GET /api/v1/library/releases`) into shapes that are
 * compatible with `ReleaseCard`. Kept as pure functions for easy unit testing
 * without Vue dependencies.
 */

/**
 * Maps a library release item (from `fetchLibraryReleases`) to a shape
 * that `ReleaseCard` understands.
 *
 * Key transformations:
 * - `id` is set to `null` — the reconciliation record `id` is a local DB UUID,
 *   not a MusicBrainz release MBID. Passing it to `ArtworkImage` would produce
 *   incorrect artwork URLs.
 * - `musicbrainzReleaseId` is carried through so `ReleaseCard`'s `releaseMbid`
 *   computed falls back to that field.
 * - `releaseGroupId` is derived from `musicbrainzReleaseGroupId` so the
 *   `releaseGroupMbid` computed in `ReleaseCard` resolves correctly for the
 *   CAA release-group fallback.
 * - `title` and `artistCredit` are mapped from the local field names so the
 *   release-normalization helpers (`getReleaseTitle`, `getReleaseArtistName`)
 *   work without modification.
 * - Track counts and `reconciliationStatus` are forwarded for display in the
 *   actions slot.
 *
 * @param {object} release - Library release object from the API.
 * @returns {object} ReleaseCard-compatible release object, or {} for null input.
 */
export function normalizeLibraryReleaseForCard(release) {
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

    // Date: getReleaseYear reads `date` — map to `date` for canonical form.
    date: release.releaseDate ?? null,

    // Release-group primary type is surfaced in the meta line by ReleaseCard.
    releaseGroup: {
      primaryType: release.releaseGroupType ?? null,
    },

    // Library-specific fields forwarded for the custom actions slot.
    reconciliationStatus: release.reconciliationStatus ?? null,
    expectedTrackCount: release.expectedTrackCount ?? 0,
    matchedTrackCount: release.matchedTrackCount ?? 0,
    missingTrackCount: release.missingTrackCount ?? 0,
    matchedFileCount: release.matchedFileCount ?? 0,
    duplicateTrackCount: release.duplicateTrackCount ?? 0,

    // Forwarded for artist-detail navigation.
    metadataArtistId: release.metadataArtistId ?? null,
  };
}

/**
 * Returns a human-readable label for a reconciliation status value.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getReconciliationStatusLabel(status) {
  if (status === 'complete') return 'In Library';
  if (status === 'partial') return 'Partial';
  if (status === 'duplicate') return 'Duplicate';
  if (!status) return 'Unknown';
  return status;
}

/**
 * Returns the design-system tone for a reconciliation status.
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'warning'|'info'}
 */
export function getReconciliationStatusTone(status) {
  if (status === 'complete') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'duplicate') return 'info';
  return 'info';
}

/**
 * Returns a track-count summary string for a library release card.
 *
 * - Returns `null` when there is no meaningful track data.
 * - Returns `'N tracks'` when the release is fully matched.
 * - Returns `'M / N tracks'` when the release is partial or has missing tracks.
 *
 * @param {object|null} release
 * @returns {string|null}
 */
export function formatLibraryTrackCounts(release) {
  if (!release) return null;
  const expected = release.expectedTrackCount ?? 0;
  if (expected <= 0) return null;
  const matched = release.matchedTrackCount ?? 0;
  if (matched >= expected) return `${expected} tracks`;
  return `${matched} / ${expected} tracks`;
}
