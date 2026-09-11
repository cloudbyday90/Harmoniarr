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

import { createProviderJsonRequestService } from '../providers/provider-json-request-service.js';

const spotifyAccountsBaseUrl = 'https://accounts.spotify.com';
const spotifyApiBaseUrl = 'https://api.spotify.com/v1';

function createSpotifyError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function createSpotifyClient({
  accessTokenProvider = null,
  clientId,
  clientSecret,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
  requestPolicy = {},
} = {}) {
  if (!accessTokenProvider && (!clientId || !clientSecret)) {
    throw createSpotifyError('spotify_misconfigured', 'Spotify client ID and client secret are required');
  }

  const { requestJson } = createProviderJsonRequestService({ provider: 'spotify', fetchFn, requestTimeoutMs, requestPolicy });

  // In-memory token cache is scoped to this client instance.
  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function fetchAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 30_000) {
      return cachedToken;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = await requestJson({ url: `${spotifyAccountsBaseUrl}/api/token`,
      body: 'grant_type=client_credentials',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST', oauth: true,
    });
    if (typeof body.access_token !== 'string' || !body.access_token
      || !Number.isSafeInteger(body.expires_in ?? 3600) || (body.expires_in ?? 3600) < 1) {
      throw Object.assign(new Error('Spotify token endpoint returned an invalid response'), { code: 'spotify_invalid_response', diagnosticCode: 'response_invalid' });
    }
    cachedToken = body.access_token;
    tokenExpiresAt = now + (body.expires_in ?? 3600) * 1000;
    return cachedToken;
  }

  async function spotifyGet(path, params = {}) {
    const token = accessTokenProvider ? await accessTokenProvider() : await fetchAccessToken();
    if (!token) {
      throw createSpotifyError('spotify_misconfigured', 'Spotify user access token is not configured');
    }
    const url = new URL(`${spotifyApiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return requestJson({ url: url.toString(), headers: { Authorization: `Bearer ${token}` } });
  }

  async function getPlaylist(playlistId, { market = null, offset = 0, limit = 50 } = {}) {
    return spotifyGet(`/playlists/${playlistId}`, {
      additional_types: 'track',
      fields: 'id,name,description,items(next,offset,total,items(track(id,name,duration_ms,artists(id,name),album(id,name,release_date,total_tracks))))',
      limit,
      market,
      offset,
    });
  }

  async function getPlaylistItems(playlistId, { market = null, offset = 0, limit = 50 } = {}) {
    return spotifyGet(`/playlists/${playlistId}/items`, {
      additional_types: 'track,episode',
      limit,
      market,
      offset,
    });
  }

  async function getPlaylistSnapshot(playlistId) {
    return spotifyGet(`/playlists/${playlistId}`, { fields: 'id,snapshot_id' });
  }

  async function getArtistAlbums(artistId, { albumTypes = 'album,single', limit = 10, offset = 0 } = {}) {
    return spotifyGet(`/artists/${artistId}/albums`, {
      include_groups: albumTypes,
      limit: Math.min(limit, 10),
      offset,
    });
  }

  async function getAlbum(albumId, { market = null } = {}) {
    return spotifyGet(`/albums/${albumId}`, { market });
  }

  async function getTrack(trackId, { market = null } = {}) {
    return spotifyGet(`/tracks/${trackId}`, { market });
  }

  async function getArtist(artistId) {
    return spotifyGet(`/artists/${artistId}`);
  }

  return {
    getPlaylistSnapshot,
    getAlbum,
    getArtist,
    getArtistAlbums,
    getPlaylist,
    getPlaylistItems,
    getTrack,
  };
}
