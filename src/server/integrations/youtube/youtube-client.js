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

const youtubeApiBaseUrl = 'https://www.googleapis.com/youtube/v3';

function createYouTubeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function classifyYouTubeStatus(status, url) {
  if (status === 400) {
    return createYouTubeError('youtube_bad_request', 'YouTube API rejected the request — check parameters', { url });
  }

  if (status === 403) {
    return createYouTubeError('youtube_forbidden', 'YouTube API access denied — check API key or quota', { url });
  }

  if (status === 404) {
    return createYouTubeError('youtube_not_found', 'YouTube resource not found', { url });
  }

  if (status === 429) {
    return createYouTubeError('youtube_rate_limited', 'YouTube API quota exceeded');
  }

  if (status >= 500) {
    return createYouTubeError('youtube_unavailable', `YouTube API returned ${status}`, { status });
  }

  return createYouTubeError('youtube_request_failed', `Unexpected YouTube API status ${status}`, { status, url });
}

export function createYouTubeClient({
  accessTokenProvider = null,
  apiKey,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
} = {}) {
  if (!apiKey && typeof accessTokenProvider !== 'function') {
    throw createYouTubeError('youtube_misconfigured', 'YouTube API key or OAuth access token provider is required');
  }

  async function youtubeGet(path, params = {}) {
    const url = new URL(`${youtubeApiBaseUrl}${path}`);
    const accessToken = typeof accessTokenProvider === 'function'
      ? await accessTokenProvider()
      : null;
    if (!accessToken && apiKey) {
      url.searchParams.set('key', apiKey);
    } else if (!accessToken) {
      throw createYouTubeError('youtube_misconfigured', 'YouTube API key or OAuth access token is required');
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      const headers = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined;
      response = await fetchFn(url.toString(), {
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createYouTubeError('youtube_timeout', `YouTube API request timed out: ${path}`);
      }

      throw createYouTubeError('youtube_unavailable', `YouTube API request failed: ${path}`, { cause: error?.message });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '60', 10);
      const err = classifyYouTubeStatus(429, url.toString());
      err.details.retryAfterSeconds = retryAfter;
      throw err;
    }

    if (!response.ok) {
      throw classifyYouTubeStatus(response.status, url.toString());
    }

    return response.json();
  }

  async function listPlaylistItems(playlistId, { maxResults = 50, pageToken = null } = {}) {
    return youtubeGet('/playlistItems', {
      maxResults,
      pageToken,
      part: 'snippet',
      playlistId,
    });
  }

  async function getVideos(videoIds) {
    const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
    return youtubeGet('/videos', {
      id: ids.join(','),
      part: 'snippet',
    });
  }

  return {
    getVideos,
    listPlaylistItems,
  };
}
