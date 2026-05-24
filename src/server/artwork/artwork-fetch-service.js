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

import { createArtworkIngestionService } from './artwork-ingestion-service.js';
import { createArtworkAssignmentService } from './artwork-assignment-service.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { listArtworkAssignments } from './artwork-repository.js';

const fanartRoleMap = {
  artistthumb: 'artist_thumbnail',
  artistbackground: 'artist_background',
  hdmusiclogo: 'artist_logo',
  musiclogo: 'artist_logo',
};

const theAudioDbRoleMap = {
  artistthumb: 'artist_thumbnail',
  artistwidethumb: 'artist_thumbnail',
  artistfanart: 'artist_background',
  artistfanart2: 'artist_background',
  artistfanart3: 'artist_background',
  artistfanart4: 'artist_background',
  artistlogo: 'artist_logo',
  artistclearart: 'artist_logo',
  artistbanner: 'artist_background',
  artistcutout: 'artist_thumbnail',
};

function buildResult(asset, sourceProvider) {
  return {
    assetId: asset.id,
    cached: false,
    dominantColor: {
      chroma: asset.dominantChroma,
      hue: asset.dominantHue,
      lightness: asset.dominantLightness,
    },
    sourceProvider,
    url: `/api/v1/artwork/assets/${asset.id}/file`,
  };
}

const emptyResult = { url: null, assetId: null, cached: false, sourceProvider: null, quotaExceeded: false };
const backoffResult = {
  url: null,
  assetId: null,
  cached: false,
  sourceProvider: null,
  quotaExceeded: false,
  retryBackoffActive: true,
  retryAfterAt: null,
};
const quotaExceededResult = { url: null, assetId: null, cached: false, sourceProvider: null, quotaExceeded: true };

export function createArtworkFetchService({
  artworkPolicyService = createArtworkPolicyService(),
  artworkIngestionService = createArtworkIngestionService({ artworkPolicyService }),
  artworkAssignmentService = createArtworkAssignmentService(),
  artworkFetchBackoffService = null,
  artworkQuotaService = null,
  coverArtArchiveClient = null,
  fanartTvClient = null,
  theAudioDbClient = null,
  listArtworkAssignmentsFn = listArtworkAssignments,
  downloadImageFn = async (url) => {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  },
} = {}) {
  const resolvedArtworkFetchBackoffService = artworkFetchBackoffService ?? {
    clearFailure: async () => {},
    recordFailure: async () => null,
    shouldBackoff: async () => ({ active: false, retryAfterAt: null }),
  };

  async function resolveFromCaa({ mbid, mbidType, ownerId, ownerType, artworkRole, refresh = false }) {
    if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('coverArtArchive')) {
      return null;
    }

    const result = await coverArtArchiveClient.fetchFrontImage({ mbid, mbidType });
    if (!result) return null;

    if (artworkQuotaService) {
      await artworkQuotaService.incrementQuota('coverArtArchive');
    }

    const { asset } = await artworkIngestionService.ingestArtworkBuffer({
      buffer: result.buffer,
      sourceProvider: 'coverArtArchive',
      sourceUrl: result.sourceUrl,
      storageClass: 'provider_original',
    });

    await artworkAssignmentService.assignPreferredArtwork({
      artworkAssetId: asset.id,
      artworkRole,
      ownerId,
      ownerType,
      priority: 100,
      sourceProvider: 'coverArtArchive',
      sourceReference: mbid,
    });

    if (refresh) {
      await artworkAssignmentService.removeStaleAssignments({
        artworkAssetId: asset.id,
        artworkRole,
        ownerId,
        ownerType,
      });
    }

    return buildResult(asset, 'coverArtArchive');
  }

  async function resolveFromFanartTv({ ownerId, ownerType, artworkRole, refresh = false }) {
    if (!fanartTvClient) return null;

    if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('fanartTv')) {
      return null;
    }

    const isArtist = ownerType === 'musicbrainz_artist';
    const isReleaseGroup = ownerType === 'musicbrainz_release_group';
    if (!isArtist && !isReleaseGroup) return null;

    const roleToImageType = {
      artist_thumbnail: 'artistthumb',
      artist_background: 'artistbackground',
      artist_logo: ['hdmusiclogo', 'musiclogo'],
      cover_front: 'albumcover',
    };

    const targetTypes = roleToImageType[artworkRole];
    if (!targetTypes) return null;

    let images;
    if (isArtist) {
      images = await fanartTvClient.fetchArtistImages({ mbid: ownerId });
    } else {
      images = await fanartTvClient.fetchAlbumImages({ mbid: ownerId });
    }

    if (!images || images.length === 0) return null;

    const typeList = Array.isArray(targetTypes) ? targetTypes : [targetTypes];
    const match = images.find((img) => typeList.includes(img.imageType));
    if (!match) return null;

    const buffer = await downloadImageFn(match.url);
    if (!buffer) return null;
    const resolvedRole = isReleaseGroup ? 'cover_front' : (fanartRoleMap[match.imageType] ?? artworkRole);

    const { asset } = await artworkIngestionService.ingestArtworkBuffer({
      buffer,
      sourceProvider: 'fanartTv',
      sourceUrl: match.url,
      storageClass: 'provider_original',
    });

    await artworkAssignmentService.assignPreferredArtwork({
      artworkAssetId: asset.id,
      artworkRole: resolvedRole,
      ownerId,
      ownerType,
      priority: 100,
      sourceProvider: 'fanartTv',
      sourceReference: ownerId,
    });

    if (refresh) {
      await artworkAssignmentService.removeStaleAssignments({
        artworkAssetId: asset.id,
        artworkRole: resolvedRole,
        ownerId,
        ownerType,
      });
    }

    if (artworkQuotaService) {
      await artworkQuotaService.incrementQuota('fanartTv');
    }

    return buildResult(asset, 'fanartTv');
  }

  async function resolveFromTheAudioDb({ ownerId, ownerType, artworkRole, refresh = false }) {
    if (!theAudioDbClient) return null;
    if (ownerType !== 'musicbrainz_artist') return null;

    if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('theAudioDb')) {
      return null;
    }

    const roleToImageType = {
      artist_thumbnail: 'artistthumb',
      artist_background: 'artistfanart',
      artist_logo: 'artistlogo',
    };

    const targetImageType = roleToImageType[artworkRole];
    if (!targetImageType) return null;

    const images = await theAudioDbClient.fetchArtistImages({ mbid: ownerId });
    if (!images || images.length === 0) return null;

    const match = images.find((img) => img.imageType === targetImageType)
      ?? images.find((img) =>
        artworkRole === 'artist_thumbnail' && ['artistthumb', 'artistwidethumb'].includes(img.imageType))
      ?? images.find((img) =>
        artworkRole === 'artist_background' && img.imageType.startsWith('artistfanart'))
      ?? images.find((img) =>
        artworkRole === 'artist_logo' && ['artistlogo', 'artistclearart'].includes(img.imageType));
    if (!match) return null;

    const buffer = await downloadImageFn(match.url);
    if (!buffer) return null;
    const resolvedRole = theAudioDbRoleMap[match.imageType] ?? artworkRole;

    const { asset } = await artworkIngestionService.ingestArtworkBuffer({
      buffer,
      sourceProvider: 'theAudioDb',
      sourceUrl: match.url,
      storageClass: 'provider_original',
    });

    await artworkAssignmentService.assignPreferredArtwork({
      artworkAssetId: asset.id,
      artworkRole: resolvedRole,
      ownerId,
      ownerType,
      priority: 100,
      sourceProvider: 'theAudioDb',
      sourceReference: ownerId,
    });

    if (refresh) {
      await artworkAssignmentService.removeStaleAssignments({
        artworkAssetId: asset.id,
        artworkRole: resolvedRole,
        ownerId,
        ownerType,
      });
    }

    if (artworkQuotaService) {
      await artworkQuotaService.incrementQuota('theAudioDb');
    }

    return buildResult(asset, 'theAudioDb');
  }

  async function resolveArtwork({ ownerType, ownerId, artworkRole = 'cover_front', refresh = false }) {
    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    if (!policy.fetch.enabled) return { ...emptyResult };

    if (!refresh) {
      const assignments = await listArtworkAssignmentsFn({ ownerType, ownerId });
      const preferred = assignments.find((a) => a.isPreferred && a.artworkRole === artworkRole);

      if (preferred) {
        await resolvedArtworkFetchBackoffService.clearFailure({ artworkRole, ownerId, ownerType });
        return {
          assetId: preferred.artworkAssetId,
          cached: true,
          dominantColor: null,
          sourceProvider: preferred.sourceProvider,
          url: `/api/v1/artwork/assets/${preferred.artworkAssetId}/file`,
        };
      }

      const retryState = await resolvedArtworkFetchBackoffService.shouldBackoff({ artworkRole, ownerId, ownerType });
      if (retryState.active) {
        return {
          ...backoffResult,
          retryAfterAt: retryState.retryAfterAt,
        };
      }
    }

    const isRelease = ownerType === 'musicbrainz_release';
    const isReleaseGroup = ownerType === 'musicbrainz_release_group';
    const isArtist = ownerType === 'musicbrainz_artist';

    let anyQuotaExceeded = false;
    let attemptedFetch = false;

    if (isRelease || isReleaseGroup) {
      if (coverArtArchiveClient) {
        if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('coverArtArchive')) {
          anyQuotaExceeded = true;
        } else {
          attemptedFetch = true;
          const caaResult = await resolveFromCaa({
            artworkRole,
            mbid: ownerId,
            mbidType: isReleaseGroup ? 'release-group' : 'release',
            ownerId,
            ownerType,
            refresh,
          });
          if (caaResult) {
            await resolvedArtworkFetchBackoffService.clearFailure({ artworkRole, ownerId, ownerType });
            return caaResult;
          }
        }
      }

      if (isReleaseGroup && fanartTvClient) {
        if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('fanartTv')) {
          anyQuotaExceeded = true;
        } else {
          attemptedFetch = true;
          const fanarResult = await resolveFromFanartTv({ artworkRole, ownerId, ownerType, refresh });
          if (fanarResult) {
            await resolvedArtworkFetchBackoffService.clearFailure({ artworkRole, ownerId, ownerType });
            return fanarResult;
          }
        }
      }
    }

    if (isArtist) {
      if (theAudioDbClient) {
        if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('theAudioDb')) {
          anyQuotaExceeded = true;
        } else {
          attemptedFetch = true;
          const theaudiodbResult = await resolveFromTheAudioDb({ artworkRole, ownerId, ownerType, refresh });
          if (theaudiodbResult) {
            await resolvedArtworkFetchBackoffService.clearFailure({ artworkRole, ownerId, ownerType });
            return theaudiodbResult;
          }
        }
      }

      if (fanartTvClient) {
        if (artworkQuotaService && await artworkQuotaService.isQuotaExceeded('fanartTv')) {
          anyQuotaExceeded = true;
        } else {
          attemptedFetch = true;
          const fanarResult = await resolveFromFanartTv({ artworkRole, ownerId, ownerType, refresh });
          if (fanarResult) {
            await resolvedArtworkFetchBackoffService.clearFailure({ artworkRole, ownerId, ownerType });
            return fanarResult;
          }
        }
      }
    }

    if (!refresh && attemptedFetch && !anyQuotaExceeded) {
      const failureState = await resolvedArtworkFetchBackoffService.recordFailure({
        artworkRole,
        failureCode: 'artwork_unavailable',
        ownerId,
        ownerType,
      });
      return {
        ...emptyResult,
        retryAfterAt: failureState?.nextRetryAt ?? null,
        retryBackoffActive: false,
      };
    }

    return anyQuotaExceeded ? { ...quotaExceededResult } : { ...emptyResult };
  }

  async function resolveArtworkBatch(requests) {
    const results = {};
    await Promise.all(requests.map(async (request) => {
      const key = `${request.ownerType}:${request.ownerId}:${request.artworkRole ?? 'cover_front'}`;
      try {
        results[key] = await resolveArtwork({
          artworkRole: request.artworkRole ?? 'cover_front',
          ownerId: request.ownerId,
          ownerType: request.ownerType,
          refresh: request.refresh ?? false,
        });
      } catch {
        results[key] = { ...emptyResult };
      }
    }));
    return results;
  }

  return { resolveArtwork, resolveArtworkBatch };
}
