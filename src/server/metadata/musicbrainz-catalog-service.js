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

import { createMusicBrainzClient } from '../integrations/musicbrainz/musicbrainz-client.js';
import {
  normalizeReleaseGroupStatus,
  normalizeReleaseGroupType,
  normalizeSearchLimit,
  normalizeSearchOffset,
} from '../validators/metadata-search-validator.js';
import { observeMusicBrainzProviderCall } from './musicbrainz-provider-health.js';
import {
  metadataProviderCacheNamespaces,
  metadataProviderCachePolicies,
} from './metadata-provider-cache-policy.js';

function buildArtistCredit(artistCredit) {
  if (!Array.isArray(artistCredit)) {
    return null;
  }

  const text = artistCredit
    .map((credit) => `${credit.name ?? credit.artist?.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('')
    .trim();

  return text || null;
}

function normalizeReleaseSummary(release) {
  return {
    id: release.id,
    sourceProvider: 'musicbrainz',
    musicbrainzReleaseId: release.id,
    title: release.title,
    status: release.status ?? null,
    releaseDate: release.date ?? null,
    country: release.country ?? null,
    barcode: release.barcode ?? null,
    disambiguation: release.disambiguation ?? null,
    artistCredit: buildArtistCredit(release['artist-credit']),
  };
}

/**
 * A stable cache key for one normalized MusicBrainz artist browse request.
 * The key contains every provider input that can alter the response.
 */
export function buildArtistReleaseGroupCacheKey({
  artistId,
  limit,
  offset,
  releaseGroupStatus,
  type,
}) {
  return new URLSearchParams({
    artistId: String(artistId),
    limit: String(limit),
    offset: String(offset),
    releaseGroupStatus: releaseGroupStatus ?? '',
    type: type ?? '',
  }).toString();
}

export function createMusicBrainzCatalogService({
  metadataProviderCacheService = null,
  musicBrainzClient = createMusicBrainzClient(),
  providerHealthRecorder = null,
} = {}) {
  async function browseArtistReleaseGroups({ artistId, limit, offset, type, releaseGroupStatus }) {
    const normalizedLimit = normalizeSearchLimit(limit, 25);
    const normalizedOffset = normalizeSearchOffset(offset, 0);
    const normalizedType = normalizeReleaseGroupType(type);
    const normalizedReleaseGroupStatus = normalizeReleaseGroupStatus(releaseGroupStatus, 'website-default');

    const loadBrowseResult = async () => {
      const payload = await observeMusicBrainzProviderCall(
        providerHealthRecorder,
        () => musicBrainzClient.browseArtistReleaseGroups({
          artistId,
          limit: normalizedLimit,
          offset: normalizedOffset,
          type: normalizedType,
          releaseGroupStatus: normalizedReleaseGroupStatus,
        }),
      );

      return {
        artistId,
        limit: normalizedLimit,
        offset: payload.offset ?? normalizedOffset,
        total: payload['release-group-count'] ?? payload.count ?? 0,
        filters: {
          type: normalizedType,
          releaseGroupStatus: normalizedReleaseGroupStatus,
        },
        results: Array.isArray(payload['release-groups'])
          ? payload['release-groups'].map((releaseGroup) => ({
              id: releaseGroup.id,
              sourceProvider: 'musicbrainz',
              musicbrainzReleaseGroupId: releaseGroup.id,
              title: releaseGroup.title,
              primaryType: releaseGroup['primary-type'] ?? null,
              secondaryTypes: Array.isArray(releaseGroup['secondary-types'])
                ? releaseGroup['secondary-types']
                : [],
              firstReleaseDate: releaseGroup['first-release-date'] ?? null,
              disambiguation: releaseGroup.disambiguation ?? null,
              artistCredit: buildArtistCredit(releaseGroup['artist-credit']),
            }))
          : [],
      };
    };

    if (!metadataProviderCacheService) {
      return loadBrowseResult();
    }

    const cached = await metadataProviderCacheService.getOrLoad({
      cacheKey: buildArtistReleaseGroupCacheKey({
        artistId,
        limit: normalizedLimit,
        offset: normalizedOffset,
        releaseGroupStatus: normalizedReleaseGroupStatus,
        type: normalizedType,
      }),
      cacheNamespace: metadataProviderCacheNamespaces.musicBrainzArtistReleaseGroups,
      load: loadBrowseResult,
      policy: metadataProviderCachePolicies.musicBrainzArtistReleaseGroups,
    });

    return {
      ...cached.payload,
      cache: cached.cache,
    };
  }

  async function getReleaseGroupReleases({ releaseGroupId, limit, offset }) {
    const normalizedLimit = normalizeSearchLimit(limit, 25);
    const normalizedOffset = normalizeSearchOffset(offset, 0);
    const payload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.browseReleaseGroupReleases({
        releaseGroupId,
        limit: normalizedLimit,
        offset: normalizedOffset,
      }),
    );

    return {
      releaseGroupId,
      limit: normalizedLimit,
      offset: payload.offset ?? normalizedOffset,
      total: payload['release-count'] ?? payload.count ?? 0,
      results: Array.isArray(payload.releases)
        ? payload.releases.map((release) => ({
            ...normalizeReleaseSummary(release),
            mediumCount: Array.isArray(release.media) ? release.media.length : null,
            trackCount: Array.isArray(release.media)
              ? release.media.reduce((total, medium) => total + (medium['track-count'] ?? 0), 0)
              : null,
          }))
        : [],
    };
  }

  return {
    browseArtistReleaseGroups,
    getReleaseGroupReleases,
  };
}
