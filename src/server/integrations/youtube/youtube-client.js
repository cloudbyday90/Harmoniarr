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

const youtubeApiBaseUrl = 'https://www.googleapis.com/youtube/v3';

function createYouTubeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function createYouTubeClient({
  accessTokenProvider = null,
  apiKey,
  requestTimeoutMs = 15000,
  fetchFn = globalThis.fetch,
  requestPolicy = {},
} = {}) {
  if (!apiKey && typeof accessTokenProvider !== 'function') {
    throw createYouTubeError('youtube_misconfigured', 'YouTube API key or OAuth access token provider is required');
  }

  const { requestJson } = createProviderJsonRequestService({ provider: 'youtube', fetchFn, requestTimeoutMs, requestPolicy });

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

    return requestJson({ url: url.toString(), headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
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
