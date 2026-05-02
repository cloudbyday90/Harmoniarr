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

const spotifyAccountsBaseUrl = 'https://accounts.spotify.com';
const spotifyApiBaseUrl = 'https://api.spotify.com/v1';

function createSpotifyError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function classifySpotifyStatus(status, url) {
  if (status === 401) {
    return createSpotifyError('spotify_unauthorized', 'Spotify authentication failed — check client credentials');
  }

  if (status === 403) {
    return createSpotifyError('spotify_forbidden', 'Spotify access denied for this resource');
  }

  if (status === 404) {
    return createSpotifyError('spotify_not_found', 'Spotify resource not found', { url });
  }

  if (status === 429) {
    return createSpotifyError('spotify_rate_limited', 'Spotify rate limit exceeded');
  }

  if (status >= 500) {
    return createSpotifyError('spotify_unavailable', `Spotify API returned ${status}`, { status });
  }

  return createSpotifyError('spotify_request_failed', `Unexpected Spotify API status ${status}`, { status, url });
}

export function createSpotifyClient({
  accessTokenProvider = null,
  clientId,
  clientSecret,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
} = {}) {
  if (!accessTokenProvider && (!clientId || !clientSecret)) {
    throw createSpotifyError('spotify_misconfigured', 'Spotify client ID and client secret are required');
  }

  // In-memory token cache — scoped to this client instance.
  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function fetchAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 30_000) {
      return cachedToken;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      response = await fetchFn(`${spotifyAccountsBaseUrl}/api/token`, {
        body: 'grant_type=client_credentials',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createSpotifyError('spotify_timeout', 'Spotify token request timed out');
      }

      throw createSpotifyError('spotify_unavailable', 'Spotify token request failed', { cause: error?.message });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw classifySpotifyStatus(response.status, `${spotifyAccountsBaseUrl}/api/token`);
    }

    const body = await response.json();
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      response = await fetchFn(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createSpotifyError('spotify_timeout', `Spotify API request timed out: ${path}`);
      }

      throw createSpotifyError('spotify_unavailable', `Spotify API request failed: ${path}`, { cause: error?.message });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '60', 10);
      const err = classifySpotifyStatus(429, url.toString());
      err.details.retryAfterSeconds = retryAfter;
      throw err;
    }

    if (!response.ok) {
      throw classifySpotifyStatus(response.status, url.toString());
    }

    return response.json();
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
      additional_types: 'track',
      fields: 'next,offset,total,items(track(id,name,duration_ms,artists(id,name),album(id,name,release_date,total_tracks)))',
      limit,
      market,
      offset,
    });
  }

  async function getArtistAlbums(artistId, { albumTypes = 'album,single,ep', limit = 50, offset = 0 } = {}) {
    return spotifyGet(`/artists/${artistId}/albums`, {
      include_groups: albumTypes,
      limit,
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
    getAlbum,
    getArtist,
    getArtistAlbums,
    getPlaylist,
    getPlaylistItems,
    getTrack,
  };
}
