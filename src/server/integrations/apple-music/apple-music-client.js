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

import { createSign } from 'node:crypto';

const appleMusicApiBaseUrl = 'https://api.music.apple.com/v1';

// Apple Music developer tokens are valid for up to 15,777,000 seconds (6 months).
// We issue tokens with a 180-day (15,552,000 s) validity and re-generate 30 days
// before expiry so the token stays valid through long deployment cycles.
const tokenLifetimeSeconds = 15_552_000;
const tokenRefreshBufferSeconds = 2_592_000; // 30 days

function createAppleMusicError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function classifyAppleMusicStatus(status, url) {
  if (status === 401) {
    return createAppleMusicError('apple_music_unauthorized', 'Apple Music authentication failed — check developer token');
  }

  if (status === 403) {
    return createAppleMusicError('apple_music_forbidden', 'Apple Music access denied for this resource', { url });
  }

  if (status === 404) {
    return createAppleMusicError('apple_music_not_found', 'Apple Music resource not found', { url });
  }

  if (status === 429) {
    return createAppleMusicError('apple_music_rate_limited', 'Apple Music API rate limit exceeded');
  }

  if (status >= 500) {
    return createAppleMusicError('apple_music_unavailable', `Apple Music API returned ${status}`, { status });
  }

  return createAppleMusicError('apple_music_request_failed', `Unexpected Apple Music API status ${status}`, { status, url });
}

/**
 * Generate a signed ES256 developer token for the Apple Music API.
 * Uses node:crypto with P-256 ECDSA and IEEE-P1363 signature encoding,
 * which is the raw r||s format required by the JWT spec (not DER).
 */
export function generateAppleMusicDeveloperToken({ teamId, keyId, privateKey }) {
  if (!teamId || !keyId || !privateKey) {
    throw createAppleMusicError('apple_music_misconfigured', 'Apple Music teamId, keyId, and privateKey are required');
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + tokenLifetimeSeconds;

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId }), 'utf8').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp, iat, iss: teamId }), 'utf8').toString('base64url');
  const signingInput = `${header}.${payload}`;

  const sign = createSign('SHA256');
  sign.update(signingInput, 'utf8');
  sign.end();

  // dsaEncoding: 'ieee-p1363' produces the raw r||s format required by JWT (RFC 7518).
  const signature = sign.sign({ dsaEncoding: 'ieee-p1363', key: privateKey }, 'base64url');
  return { expiresAt: exp * 1000, token: `${signingInput}.${signature}` };
}

export function createAppleMusicClient({
  teamId,
  keyId,
  privateKey,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
} = {}) {
  if (!teamId || !keyId || !privateKey) {
    throw createAppleMusicError('apple_music_misconfigured', 'Apple Music teamId, keyId, and privateKey are required');
  }

  // In-memory token cache — scoped to this client instance.
  let cachedToken = null;
  let tokenExpiresAt = 0;

  function getToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - tokenRefreshBufferSeconds * 1000) {
      return cachedToken;
    }

    const { expiresAt, token } = generateAppleMusicDeveloperToken({ keyId, privateKey, teamId });
    cachedToken = token;
    tokenExpiresAt = expiresAt;
    return cachedToken;
  }

  async function appleMusicGet(path, params = {}) {
    const token = getToken();
    const url = new URL(`${appleMusicApiBaseUrl}${path}`);
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
        throw createAppleMusicError('apple_music_timeout', `Apple Music API request timed out: ${path}`);
      }

      throw createAppleMusicError('apple_music_unavailable', `Apple Music API request failed: ${path}`, { cause: error?.message });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '60', 10);
      const err = classifyAppleMusicStatus(429, url.toString());
      err.details.retryAfterSeconds = retryAfter;
      throw err;
    }

    if (!response.ok) {
      throw classifyAppleMusicStatus(response.status, url.toString());
    }

    return response.json();
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
    getCatalogAlbum,
    getCatalogArtist,
    getCatalogPlaylist,
    getCatalogSong,
  };
}
