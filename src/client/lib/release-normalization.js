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
 * Release normalization helpers.
 *
 * Provides stable request key derivation and request payload normalization
 * for MusicBrainz release search results. Shared by `useReleaseRequest.js`,
 * `ReleaseCard.vue`, and related components.
 */

/**
 * Returns the display artist name for a release.
 *
 * Prefers the full `artistCredit` string (e.g. "Daft Punk & Gorillaz"), then
 * falls back to the first artist object's name, then the top-level `artistName`
 * field (present on local metadata releases), then null.
 *
 * @param {object} release
 * @returns {string|null}
 */
export function getReleaseArtistName(release) {
  if (!release) return null;
  if (typeof release.artistCredit === 'string' && release.artistCredit.trim()) {
    return release.artistCredit.trim();
  }
  if (release.artist?.name && typeof release.artist.name === 'string') {
    return release.artist.name.trim() || null;
  }
  if (typeof release.artistName === 'string' && release.artistName.trim()) {
    return release.artistName.trim();
  }
  return null;
}

/**
 * Returns the release title.
 *
 * @param {object} release
 * @returns {string|null}
 */
export function getReleaseTitle(release) {
  if (!release) return null;
  const title = release.title ?? release.releaseTitle ?? null;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/**
 * Returns a 4-digit year string derived from the release date, or null.
 *
 * @param {object} release
 * @returns {string|null}
 */
export function getReleaseYear(release) {
  if (!release) return null;
  const raw = release.date ?? release.releaseDate ?? null;
  if (!raw) return null;
  const match = String(raw).match(/^(\d{4})/);
  return match ? match[1] : null;
}

/**
 * Normalizes a string to a lowercase, whitespace-collapsed token suitable for
 * use as part of a fallback key.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeKeyPart(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a stable, unique string key for a release that can be used to
 * deduplicate request state across visible result cards.
 *
 * Key priority:
 *   1. `release:<mbid>` — preferred; uses the MusicBrainz release ID.
 *   2. `release-group:<mbid>` — falls back to the release-group ID if the
 *      release MBID is unavailable. Two results in different releases of the
 *      same release-group will share a key (intentional — they represent the
 *      same logical release request).
 *   3. `text:<normalizedArtist>:<normalizedTitle>:<year>` — last resort when
 *      no MBID is available.
 *
 * If none of the above can be derived, returns null. A null key means the
 * release cannot be requested.
 *
 * @param {object} release
 * @returns {string|null}
 */
export function getReleaseRequestKey(release) {
  if (!release) return null;

  // 1. MusicBrainz release MBID
  const mbid = release.id ?? release.musicbrainzReleaseId ?? null;
  if (mbid && typeof mbid === 'string') {
    return `release:${mbid}`;
  }

  // 2. MusicBrainz release-group MBID
  const rgId = release.releaseGroup?.id ?? release.releaseGroupId ?? null;
  if (rgId && typeof rgId === 'string') {
    return `release-group:${rgId}`;
  }

  // 3. Normalized text fallback
  const artist = normalizeKeyPart(getReleaseArtistName(release));
  const title = normalizeKeyPart(getReleaseTitle(release));
  if (!artist && !title) return null;
  const year = getReleaseYear(release) ?? '';
  return `text:${artist}:${title}:${year}`;
}

/**
 * Returns true if the release has the minimum fields required for a request
 * (non-empty artist name and release title). Releases that fail this check
 * should have their request action disabled.
 *
 * @param {object} release
 * @returns {boolean}
 */
export function canRequestRelease(release) {
  return Boolean(getReleaseArtistName(release) && getReleaseTitle(release));
}

/**
 * Builds the request payload expected by `createMediaRequest` from a release
 * search result.
 *
 * @param {object} release
 * @returns {{ artistName: string, releaseTitle: string, requestKind: 'release' }|null}
 *   Returns null if the release cannot be requested (missing required fields).
 */
export function normalizeReleaseForRequest(release) {
  const artistName = getReleaseArtistName(release);
  const releaseTitle = getReleaseTitle(release);

  if (!artistName || !releaseTitle) {
    return null;
  }

  return {
    artistName,
    releaseTitle,
    requestKind: 'release',
  };
}
