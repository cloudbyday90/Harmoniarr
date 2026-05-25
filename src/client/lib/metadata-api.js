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

import { apiRequest, buildQueryString } from './api.js';

export function fetchMetadataArtist(artistId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/artists/${encodeURIComponent(artistId)}`, { signal });
}

export function fetchMetadataArtistDetectionEvents(artistId, { before, limit, signal } = {}) {
  return apiRequest(
    `/api/v1/metadata/artists/${encodeURIComponent(artistId)}/detection-events${buildQueryString({ before, limit })}`,
    { signal },
  );
}

export function searchLocalMetadataArtists({ query, limit } = {}) {
  return apiRequest(`/api/v1/metadata/artists/search${buildQueryString({ q: query, limit })}`);
}

export function fetchAdminMonitoredArtists({ limit, offset, search, sort, signal } = {}) {
  return apiRequest(`/api/v1/metadata/artists/monitored/admin${buildQueryString({ limit, offset, search, sort })}`, { signal });
}

export function fetchMonitoredArtists({ limit, signal } = {}) {
  return apiRequest(`/api/v1/metadata/artists/monitored${buildQueryString({ limit })}`, { signal });
}

export function searchLocalMetadataReleaseGroups({ query, limit } = {}) {
  return apiRequest(`/api/v1/metadata/release-groups/search${buildQueryString({ q: query, limit })}`);
}

export function searchLocalMetadataReleases({ query, limit } = {}) {
  return apiRequest(`/api/v1/metadata/releases/search${buildQueryString({ q: query, limit })}`);
}

export function fetchMetadataReleaseGroup(releaseGroupId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/release-groups/${encodeURIComponent(releaseGroupId)}`, { signal });
}

export function fetchMetadataRelease(releaseId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/releases/${encodeURIComponent(releaseId)}`, { signal });
}

export function resolveMusicBrainzArtistLocal(artistId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/artists/${encodeURIComponent(artistId)}/local`, { signal });
}

export function resolveMusicBrainzReleaseGroupLocal(releaseGroupId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/release-groups/${encodeURIComponent(releaseGroupId)}/local`, { signal });
}

export function resolveMusicBrainzReleaseLocal(releaseId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/releases/${encodeURIComponent(releaseId)}/local`, { signal });
}

export function searchMusicBrainzArtists({ query, limit } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/artists/search${buildQueryString({ q: query, limit })}`);
}

export function searchMusicBrainzReleases({ artist, release, limit } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/releases/search${buildQueryString({ artist, release, limit })}`);
}

export function fetchSimilarArtists(artistId, { limit, signal } = {}) {
  return apiRequest(
    `/api/v1/metadata/artists/${encodeURIComponent(artistId)}/similar${buildQueryString({ limit })}`,
    { signal },
  );
}

export function browseMusicBrainzArtistReleaseGroups({ artistId, limit, offset, type, releaseGroupStatus, signal } = {}) {
  return apiRequest(
    `/api/v1/metadata/musicbrainz/artists/${encodeURIComponent(artistId)}/release-groups${buildQueryString({
      limit,
      offset,
      type,
      releaseGroupStatus,
    })}`,
    { signal },
  );
}

export function fetchMusicBrainzReleaseGroupReleases(releaseGroupId, { signal } = {}) {
  return apiRequest(`/api/v1/metadata/musicbrainz/release-groups/${encodeURIComponent(releaseGroupId)}/releases`, { signal });
}

export function importMusicBrainzArtist(artistId) {
  return apiRequest(`/api/v1/metadata/musicbrainz/artists/${encodeURIComponent(artistId)}/import`, {
    method: 'POST',
    includeCsrf: true,
  });
}

export function updateMetadataArtistMonitoring(artistId, patch) {
  return apiRequest(`/api/v1/metadata/artists/${encodeURIComponent(artistId)}/monitoring`, {
    method: 'PUT',
    includeCsrf: true,
    body: patch,
  });
}

export function startMetadataArtistRefresh(artistId) {
  return apiRequest(`/api/v1/metadata/artists/${encodeURIComponent(artistId)}/refresh`, {
    method: 'POST',
    includeCsrf: true,
  });
}

export function importMusicBrainzReleaseGroup(releaseGroupId) {
  return apiRequest(`/api/v1/metadata/musicbrainz/release-groups/${encodeURIComponent(releaseGroupId)}/import`, {
    method: 'POST',
    includeCsrf: true,
  });
}

export function importMusicBrainzRelease(releaseId) {
  return apiRequest(`/api/v1/metadata/musicbrainz/releases/${encodeURIComponent(releaseId)}/import`, {
    method: 'POST',
    includeCsrf: true,
  });
}

export function fetchReleaseGroupTracklist(releaseGroupMbid, { preferReleaseMbid, preferReleaseId, signal } = {}) {
  return apiRequest(
    `/api/v1/metadata/musicbrainz/release-groups/${encodeURIComponent(releaseGroupMbid)}/tracklist${buildQueryString({ preferReleaseMbid, preferReleaseId })}`,
    { signal },
  );
}

export function markReleaseCanonical(releaseId) {
  return apiRequest(`/api/v1/metadata/releases/${encodeURIComponent(releaseId)}/canonical`, {
    method: 'PATCH',
    includeCsrf: true,
  });
}