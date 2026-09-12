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

import { getCurrentScope, onScopeDispose, readonly, ref, toValue, watch } from 'vue';
import {
  batchResolveArtwork as defaultBatchResolveArtwork,
  resolveArtwork as defaultResolveArtwork,
} from '../lib/artwork-api.js';

import { createArtworkBatchResolver } from '../lib/artwork-batch-resolver.js';

function artworkKey(ownerType, ownerId, artworkRole) {
  return `${ownerType}:${ownerId}:${artworkRole}`;
}

export function buildArtistDetailDiscographyArtworkRequests(sections, existingArtwork = {}) {
  const requests = [];
  const seenKeys = new Set();

  for (const section of sections ?? []) {
    for (const release of section?.releases ?? []) {
      const ownerId = release?.musicbrainzReleaseGroupId ?? null;
      if (!ownerId) {
        continue;
      }

      const key = artworkKey('musicbrainz_release_group', ownerId, 'cover_front');
      if (seenKeys.has(key) || existingArtwork[key]) {
        continue;
      }

      seenKeys.add(key);
      requests.push({
        artworkRole: 'cover_front',
        ownerId,
        ownerType: 'musicbrainz_release_group',
      });
    }
  }

  return requests;
}

export function buildArtistDetailRelatedArtworkRequests(artists, existingArtwork = {}) {
  const requests = [];
  const seenKeys = new Set();

  for (const artist of artists ?? []) {
    const ownerId = artist?.id ?? null;
    if (!ownerId) {
      continue;
    }

    const key = artworkKey('musicbrainz_artist', ownerId, 'artist_thumbnail');
    if (seenKeys.has(key) || existingArtwork[key]) {
      continue;
    }

    seenKeys.add(key);
    requests.push({
      artworkRole: 'artist_thumbnail',
      ownerId,
      ownerType: 'musicbrainz_artist',
    });
  }

  return requests;
}

export function useArtistDetailArtwork({
  artistMbid,
  discographySections,
  relatedArtists,
  batchResolveArtworkFn = defaultBatchResolveArtwork,
  resolveArtworkFn = defaultResolveArtwork,
} = {}) {
  const heroBackgroundUrl = ref(null);
  const heroThumbnailUrl = ref(null);
  const isRefreshingArtwork = ref(false);
  const discographyArtwork = ref({});
  const relatedArtwork = ref({});

  const { resolveBatches } = createArtworkBatchResolver({ batchResolveFn: batchResolveArtworkFn });
  let heroLoadToken = 0;
  let disposed = false;
  if (getCurrentScope()) {
    onScopeDispose(() => { disposed = true; heroLoadToken += 1; });
  }

  async function loadArtistArtwork(refresh = false) {
    const token = ++heroLoadToken;
    const currentMbid = toValue(artistMbid);
    if (!currentMbid || disposed) {
      isRefreshingArtwork.value = false;
      heroBackgroundUrl.value = null;
      heroThumbnailUrl.value = null;
      return;
    }

    if (!refresh) {
      heroBackgroundUrl.value = null;
      heroThumbnailUrl.value = null;
    }

    isRefreshingArtwork.value = true;
    try {
      const [backgroundResult, thumbnailResult] = await Promise.allSettled([
        Promise.resolve().then(() => resolveArtworkFn({
          artworkRole: 'artist_background',
          ownerId: currentMbid,
          ownerType: 'musicbrainz_artist',
          refresh,
        })),
        Promise.resolve().then(() => resolveArtworkFn({
          artworkRole: 'artist_thumbnail',
          ownerId: currentMbid,
          ownerType: 'musicbrainz_artist',
          refresh,
        })),
      ]);

      if (token !== heroLoadToken || currentMbid !== toValue(artistMbid)) {
        return;
      }

      if (backgroundResult.status === 'fulfilled') {
        heroBackgroundUrl.value = backgroundResult.value?.url ?? null;
      }
      if (thumbnailResult.status === 'fulfilled') {
        heroThumbnailUrl.value = thumbnailResult.value?.url ?? null;
      }
    } catch {
      if (token !== heroLoadToken || currentMbid !== toValue(artistMbid)) {
        return;
      }

      heroBackgroundUrl.value = null;
      heroThumbnailUrl.value = null;
    } finally {
      if (token === heroLoadToken) {
        isRefreshingArtwork.value = false;
      }
    }
  }

  function getReleaseArtwork(releaseGroupMbid) {
    return discographyArtwork.value[artworkKey('musicbrainz_release_group', releaseGroupMbid, 'cover_front')] ?? null;
  }

  function getRelatedArtwork(artistId) {
    return relatedArtwork.value[artworkKey('musicbrainz_artist', artistId, 'artist_thumbnail')] ?? null;
  }

  watch(() => toValue(artistMbid), () => {
    discographyArtwork.value = {};
    relatedArtwork.value = {};
    void loadArtistArtwork(false);
  }, { immediate: true });

  function watchArtwork(source, buildRequests, target) {
    watch([() => toValue(artistMbid), () => toValue(source)], ([mbid, entries], _previous, onCleanup) => {
      let active = true;
      onCleanup(() => { active = false; });
      if (!mbid) return;
      const shouldContinue = () => active && !disposed && mbid === toValue(artistMbid);
      void resolveBatches(buildRequests(entries, target.value), {
        shouldContinue,
        onResolved: (resolved) => {
          target.value = { ...target.value, ...resolved };
        },
      });
    }, { immediate: true });
  }

  watchArtwork(discographySections, buildArtistDetailDiscographyArtworkRequests, discographyArtwork);
  watchArtwork(relatedArtists, buildArtistDetailRelatedArtworkRequests, relatedArtwork);

  return {
    discographyArtwork: readonly(discographyArtwork),
    getRelatedArtwork,
    getReleaseArtwork,
    heroBackgroundUrl: readonly(heroBackgroundUrl),
    heroThumbnailUrl: readonly(heroThumbnailUrl),
    isRefreshingArtwork: readonly(isRefreshingArtwork),
    loadArtistArtwork,
    relatedArtwork: readonly(relatedArtwork),
  };
}
