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
  const trackWord = expected === 1 ? 'track' : 'tracks';
  if (matched >= expected) return `${expected} ${trackWord}`;
  return `${matched} of ${expected} ${trackWord}`;
}

/**
 * Sorts a list of wanted releases by the given field and order.
 * Operates on raw API release objects (before normalization).
 *
 * @param {Array} releases
 * @param {'artist'|'title'|'date'} field
 * @param {'asc'|'desc'} order
 * @returns {Array}
 */
export function sortWantedReleases(releases, field, order) {
  if (!Array.isArray(releases) || releases.length === 0) return releases ?? [];
  const dir = order === 'asc' ? 1 : -1;
  return [...releases].sort((a, b) => {
    let av, bv;
    if (field === 'title') {
      av = (a.releaseGroupTitle ?? '').toLowerCase();
      bv = (b.releaseGroupTitle ?? '').toLowerCase();
    } else if (field === 'date') {
      av = a.releaseDate ?? '';
      bv = b.releaseDate ?? '';
    } else {
      av = (a.artistSortName ?? a.artistName ?? '').toLowerCase();
      bv = (b.artistSortName ?? b.artistName ?? '').toLowerCase();
    }
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
}

/**
 * Returns the user-facing page subtitle for the Missing screen.
 *
 * @returns {string}
 */
export function buildMissingPageSubtitle() {
  return 'Monitored releases not yet fully acquired. Request any release to start filling the gaps.';
}

/**
 * Builds the frozen stat card array for the Missing screen.
 *
 * @param {number} monitoredCount
 * @param {number} totalWanted
 * @param {number} missingCount
 * @param {number} partialCount
 * @returns {readonly Array<{label: string, value: number, meta: string}>}
 */
export function buildMissingStatCards(monitoredCount, totalWanted, missingCount, partialCount) {
  return Object.freeze([
    Object.freeze({ label: 'Monitored artists', value: monitoredCount, meta: 'Tracked for new releases' }),
    Object.freeze({ label: 'Wanted releases', value: totalWanted, meta: 'Missing + partial' }),
    Object.freeze({ label: 'Missing', value: missingCount, meta: 'Zero files acquired' }),
    Object.freeze({ label: 'Partial', value: partialCount, meta: 'Some tracks acquired' }),
  ]);
}

/**
 * Returns the subtitle for the wanted releases card, or null when count is
 * zero or absent so the subtitle element can be conditionally rendered.
 *
 * @param {number|null|undefined} count
 * @returns {string|null}
 */
export function buildWantedReleasesCardSubtitle(count) {
  if (!count || count <= 0) return null;
  if (count === 1) return '1 release pending acquisition';
  return `${count} releases pending acquisition`;
}

/**
 * Returns the design-system tone for a missing-screen summary status value.
 *
 * @param {string|null} status
 * @returns {'success'|'danger'|'warning'}
 */
export function getMissingSummaryTone(status) {
  if (status === 'healthy' || status === 'complete') return 'success';
  if (status === 'unavailable' || status === 'failed') return 'danger';
  return 'warning';
}

/**
 * Returns true when the summary status pill should be rendered.
 *
 * @param {string|null} status
 * @returns {boolean}
 */
export function shouldShowMissingSummaryPill(status) {
  return Boolean(status) && status !== 'empty';
}

/**
 * Returns a capitalised, user-facing label for a summary status value.
 *
 * @param {string|null} status
 * @returns {string}
 */
export function formatMissingSummaryStatus(status) {
  if (!status) return '';
  if (status === 'complete') return 'Complete';
  if (status === 'healthy') return 'Healthy';
  if (status === 'partial') return 'Partial';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'failed') return 'Failed';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Formats a `lastReconciledAt` API timestamp for user-facing display.
 * Returns 'never' for null/undefined, a locale-formatted datetime string for
 * valid ISO 8601 values, and the raw value as a fallback.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatLastReconciledAt(value) {
  if (!value) return 'Never updated';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `Last updated ${d.toLocaleString()}`;
  } catch {
    return value;
  }
}
