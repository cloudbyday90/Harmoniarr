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

import { computed, toValue, watch } from 'vue';
import { useArtworkBatchResolve } from './useArtworkBatchResolve.js';

function keyForArtwork(ownerType, ownerId, artworkRole) {
  return `${ownerType}:${ownerId}:${artworkRole}`;
}

export function buildDiscoverArtistArtworkRequests(artistIds, getResolvedArtwork) {
  const requests = [];
  const seenKeys = new Set();

  for (const artistId of artistIds) {
    if (!artistId) {
      continue;
    }

    const requestKey = keyForArtwork('musicbrainz_artist', artistId, 'artist_thumbnail');
    if (seenKeys.has(requestKey)) {
      continue;
    }

    seenKeys.add(requestKey);
    if (getResolvedArtwork('musicbrainz_artist', artistId, 'artist_thumbnail')) {
      continue;
    }

    requests.push({
      artworkRole: 'artist_thumbnail',
      ownerId: artistId,
      ownerType: 'musicbrainz_artist',
    });
  }

  return requests;
}

export function useDiscoverArtistArtwork({
  artistSources = [],
  createArtworkBatchResolve = useArtworkBatchResolve,
} = {}) {
  const {
    getResolved,
    isResolving,
    resolve,
  } = createArtworkBatchResolve();

  const trackedArtistIds = computed(() => {
    const ids = [];
    for (const source of artistSources) {
      const collection = toValue(source);
      if (!Array.isArray(collection)) {
        continue;
      }

      for (const artist of collection) {
        const artistId = artist?.id ?? null;
        if (artistId) {
          ids.push(artistId);
        }
      }
    }
    return ids;
  });

  watch(trackedArtistIds, (artistIds) => {
    const requests = buildDiscoverArtistArtworkRequests(artistIds, getResolved);
    if (requests.length > 0) {
      void resolve(requests);
    }
  }, { immediate: true });

  function getArtistArtwork(artistId) {
    return getResolved('musicbrainz_artist', artistId, 'artist_thumbnail');
  }

  return {
    getArtistArtwork,
    isResolvingArtistArtwork: isResolving,
    trackedArtistIds,
  };
}
