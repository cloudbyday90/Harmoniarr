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
    duplicateFileCount: release.duplicateFileCount ?? release.duplicateTrackCount ?? 0,
    operatorVisibility: release.operatorVisibility ?? { state: 'visible' },

    // Forwarded for local metadata navigation and artist-detail navigation.
    metadataArtistId: release.metadataArtistId ?? null,
    metadataReleaseGroupId: release.metadataReleaseGroupId ?? null,
    metadataReleaseId: release.metadataReleaseId ?? null,
  };
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

function normalizeNullableString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Returns the number of missing tracks for a partial library release.
 *
 * @param {object|null} release
 * @returns {number}
 */
export function getRemainingLibraryTrackCount(release) {
  if (!release) return 0;
  const explicitMissing = normalizePositiveInteger(release.missingTrackCount);
  if (explicitMissing > 0) return explicitMissing;

  const expected = normalizePositiveInteger(release.expectedTrackCount);
  const matched = normalizePositiveInteger(release.matchedTrackCount);
  return Math.max(expected - matched, 0);
}

/**
 * Returns the number of duplicate files for a duplicate library release.
 *
 * @param {object|null} release
 * @returns {number}
 */
export function getLibraryDuplicateFileCount(release) {
  return normalizePositiveInteger(release?.duplicateFileCount ?? release?.duplicateTrackCount);
}

/**
 * Returns the CTA label for a partial release.
 *
 * @param {object|null} release
 * @returns {string}
 */
export function formatRemainingTrackRequestLabel(release) {
  const remaining = getRemainingLibraryTrackCount(release);
  const noun = remaining === 1 ? 'track' : 'tracks';
  return `Request remaining ${remaining} ${noun}`;
}

/**
 * Returns a duplicate-file count label for duplicate release rows.
 *
 * @param {object|null} release
 * @returns {string}
 */
export function formatLibraryDuplicateFileCount(release) {
  const count = getLibraryDuplicateFileCount(release);
  const noun = count === 1 ? 'file' : 'files';
  return `${count} duplicate ${noun}`;
}

/**
 * Builds the structured "Needs Attention" groups shown above the Library grid.
 *
 * @param {ReadonlyArray<object>} releases
 * @param {{partialLimit?: number}} options
 * @returns {Readonly<{partialReleases: ReadonlyArray<object>, partialOverflowCount: number, duplicateReleases: ReadonlyArray<object>, hasAttention: boolean}>}
 */
export function buildLibraryNeedsAttention(releases, { partialLimit = 5 } = {}) {
  const source = Array.isArray(releases) ? releases : [];
  const limit = Math.max(Math.floor(Number(partialLimit) || 0), 0);
  const allPartialReleases = source.filter((release) =>
    release?.reconciliationStatus === 'partial' && getRemainingLibraryTrackCount(release) > 0,
  );
  const partialReleases = allPartialReleases.slice(0, limit);
  const duplicateReleases = source.filter((release) =>
    release?.reconciliationStatus === 'duplicate' && getLibraryDuplicateFileCount(release) > 0,
  );

  return Object.freeze({
    partialReleases: Object.freeze(partialReleases),
    partialOverflowCount: Math.max(allPartialReleases.length - partialReleases.length, 0),
    duplicateReleases: Object.freeze(duplicateReleases),
    hasAttention: partialReleases.length > 0 || duplicateReleases.length > 0,
  });
}

/**
 * Builds the exact Library Browser deep link for reviewing duplicate files.
 *
 * @param {object|null} release
 * @returns {{name: string, query: {releaseGroupId: string}}|null}
 */
export function buildLibraryDuplicateReviewLocation(release) {
  const releaseGroupId = normalizeNullableString(release?.metadataReleaseGroupId);
  if (!releaseGroupId) {
    return null;
  }

  return {
    name: 'settings-library-browser',
    query: { releaseGroupId },
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
 * - Returns `'N track'` / `'N tracks'` when the release is fully matched.
 * - Returns `'M of N tracks'` when the release is partial or has missing tracks.
 *
 * @param {object|null} release
 * @returns {string|null}
 */
export function formatLibraryTrackCounts(release) {
  if (!release) return null;
  const expected = release.expectedTrackCount ?? 0;
  if (expected <= 0) return null;
  const matched = release.matchedTrackCount ?? 0;
  if (matched >= expected) return `${expected} ${expected === 1 ? 'track' : 'tracks'}`;
  return `${matched} of ${expected} tracks`;
}

/**
 * Returns the page-level subtitle for the Library screen.
 *
 * @returns {string}
 */
export function buildLibraryPageSubtitle() {
  return 'All albums and releases found in your library. Status updates after each scan.';
}

/**
 * Returns the four stat card display objects for the Library page.
 * Each card has `label`, `value`, and `meta` fields.
 *
 * @param {number} total
 * @param {number} complete - Releases with status `complete`.
 * @param {number} partial  - Releases with status `partial`.
 * @param {number} duplicate - Releases with status `duplicate`.
 * @returns {ReadonlyArray<Readonly<{label: string, value: number, meta: string}>>}
 */
export function buildLibraryStatCards(total, complete, partial, duplicate) {
  return Object.freeze([
    Object.freeze({ label: 'Total releases', value: total,    meta: 'Across all statuses' }),
    Object.freeze({ label: 'In Library',     value: complete, meta: 'Fully matched' }),
    Object.freeze({ label: 'Partial',        value: partial,  meta: 'Some tracks missing' }),
    Object.freeze({ label: 'Duplicate',      value: duplicate, meta: 'Duplicate tracks found' }),
  ]);
}

/**
 * Returns the subtitle for the Releases card, or `null` when there are no
 * releases (suppresses the count in the empty-state view).
 *
 * @param {number} count
 * @returns {string|null}
 */
export function buildLibraryReleasesCardSubtitle(count) {
  if (!count || count <= 0) return null;
  return `${count} ${count === 1 ? 'release' : 'releases'}`;
}
