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

function addArtworkRequest(requests, seenKeys, ownerType, ownerId) {
  if (!ownerId) {
    return;
  }

  const key = `${ownerType}:${ownerId}:cover_front`;
  if (seenKeys.has(key)) {
    return;
  }

  seenKeys.add(key);
  requests.push({
    artworkRole: 'cover_front',
    ownerId,
    ownerType,
  });
}

export function buildReleaseArtworkRequests(releases) {
  if (!Array.isArray(releases) || releases.length === 0) {
    return [];
  }

  const requests = [];
  const seenKeys = new Set();

  for (const release of releases) {
    addArtworkRequest(
      requests,
      seenKeys,
      'musicbrainz_release',
      release?.id ?? release?.musicbrainzReleaseId ?? null,
    );
    addArtworkRequest(
      requests,
      seenKeys,
      'musicbrainz_release_group',
      release?.releaseGroup?.id ?? release?.releaseGroupId ?? null,
    );
  }

  return requests;
}

export function getPreferredReleaseArtwork(getResolvedArtwork, release) {
  const releaseId = release?.id ?? release?.musicbrainzReleaseId ?? null;
  const releaseGroupId = release?.releaseGroup?.id ?? release?.releaseGroupId ?? null;

  return getResolvedArtwork('musicbrainz_release', releaseId, 'cover_front')
    ?? getResolvedArtwork('musicbrainz_release_group', releaseGroupId, 'cover_front')
    ?? null;
}
