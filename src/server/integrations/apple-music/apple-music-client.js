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

import { createAppleMusicDeveloperTokenService, generateAppleMusicDeveloperToken } from './apple-music-developer-token-service.js';
import { createProviderJsonRequestService } from '../providers/provider-json-request-service.js';

export { generateAppleMusicDeveloperToken };

const appleMusicApiBaseUrl = 'https://api.music.apple.com/v1';

function createAppleMusicError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function createAppleMusicClient({
  teamId,
  keyId,
  privateKey,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
  requestPolicy = {},
  providerHttpService,
} = {}) {
  if (!teamId || !keyId || !privateKey) {
    throw createAppleMusicError('apple_music_misconfigured', 'Apple Music teamId, keyId, and privateKey are required');
  }

  const { requestJson } = createProviderJsonRequestService({ provider: 'apple_music', fetchFn, requestTimeoutMs, requestPolicy, providerHttpService });

  const { getToken } = createAppleMusicDeveloperTokenService({ teamId, keyId, privateKey });

  async function appleMusicGet(path, params = {}) {
    const token = getToken();
    const url = new URL(`${appleMusicApiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return requestJson({ url: url.toString(), headers: { Authorization: `Bearer ${token}` } });
  }

  async function getCatalogPlaylist(storefront, playlistId, { offset = 0, limit = 100 } = {}) {
    return appleMusicGet(`/catalog/${storefront}/playlists/${playlistId}`, {
      'include[music-videos]': 'artists',
      'include[songs]': 'albums,artists',
      limit,
      offset,
    });
  }

  async function getCatalogAlbum(storefront, albumId) {
    return appleMusicGet(`/catalog/${storefront}/albums/${albumId}`, {
      'include': 'artists,tracks',
    });
  }

  async function getCatalogPlaylistTracks(storefront, playlistId, { offset = 0, limit = 100 } = {}) {
    return appleMusicGet(`/catalog/${storefront}/playlists/${playlistId}/tracks`, { include: 'albums,artists', limit, offset });
  }

  async function getCatalogArtistAlbums(storefront, artistId, { offset = 0, limit = 25 } = {}) {
    return appleMusicGet(`/catalog/${storefront}/artists/${artistId}/albums`, { limit, offset });
  }

  async function getCatalogArtist(storefront, artistId, { offset = 0, limit = 25 } = {}) {
    return appleMusicGet(`/catalog/${storefront}/artists/${artistId}`, {
      'include': 'albums',
      'limit[albums]': limit,
      'offset[albums]': offset,
    });
  }

  async function getCatalogSong(storefront, songId) {
    return appleMusicGet(`/catalog/${storefront}/songs/${songId}`, {
      'include': 'albums,artists',
    });
  }

  return {
    getCatalogPlaylistTracks,
    getCatalogArtistAlbums,
    getCatalogAlbum,
    getCatalogArtist,
    getCatalogPlaylist,
    getCatalogSong,
  };
}
