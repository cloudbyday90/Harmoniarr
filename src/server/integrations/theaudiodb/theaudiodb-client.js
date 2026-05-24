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

import {
  normalizeOutboundBaseUrl,
  resolveAllowedOutboundHosts,
  resolveAllowedOutboundHostSuffixes,
} from '../../outbound-url-policy.js';

function createTheAudioDbError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => { setTimeout(resolve, delayMs); });
}

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createTheAudioDbError('theaudiodb_misconfigured', `Expected a positive integer but received ${value}`);
  }
  return parsed;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://www.theaudiodb.com/api/v1/json';
  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/api/v1/json/',
      fieldName: 'THEAUDIODB_BASE_URL',
      protocolErrorCode: 'theaudiodb_misconfigured',
      validationErrorCode: 'theaudiodb_misconfigured',
    });
  } catch {
    throw createTheAudioDbError('theaudiodb_misconfigured', `Invalid TheAudioDB base URL: ${candidate}`);
  }
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - nowMs);
  return null;
}

function computeBackoffDelay(attemptNumber, baseMs) {
  const bounded = Math.min(attemptNumber, 4);
  return baseMs * (2 ** bounded) + Math.floor(Math.random() * 250);
}

const artistImageFields = [
  { field: 'strArtistThumb', imageType: 'artistthumb' },
  { field: 'strArtistWideThumb', imageType: 'artistwidethumb' },
  { field: 'strArtistFanart', imageType: 'artistfanart' },
  { field: 'strArtistFanart2', imageType: 'artistfanart2' },
  { field: 'strArtistFanart3', imageType: 'artistfanart3' },
  { field: 'strArtistFanart4', imageType: 'artistfanart4' },
  { field: 'strArtistLogo', imageType: 'artistlogo' },
  { field: 'strArtistClearart', imageType: 'artistclearart' },
  { field: 'strArtistBanner', imageType: 'artistbanner' },
  { field: 'strArtistCutout', imageType: 'artistcutout' },
];

export function selectArtistImages(artist) {
  if (!artist || typeof artist !== 'object') return [];
  const results = [];
  for (const { field, imageType } of artistImageFields) {
    const url = artist[field];
    if (typeof url === 'string' && url.trim().length > 0) {
      results.push({ imageType, url: url.trim() });
    }
  }
  return results;
}

export function createTheAudioDbClient({
  allowedHosts = process.env.THEAUDIODB_ALLOWED_HOSTS == null
    ? ['theaudiodb.com', 'www.theaudiodb.com']
    : resolveAllowedOutboundHosts(process.env.THEAUDIODB_ALLOWED_HOSTS, { envName: 'THEAUDIODB_ALLOWED_HOSTS' }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.THEAUDIODB_ALLOWED_HOST_SUFFIXES, {
    envName: 'THEAUDIODB_ALLOWED_HOST_SUFFIXES',
  }),
  apiKey = process.env.THEAUDIODB_API_KEY ?? '123',
  baseUrl = process.env.THEAUDIODB_BASE_URL,
  requestTimeoutMs = process.env.THEAUDIODB_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.THEAUDIODB_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 15000);
  const effectiveMaxRetries = Math.max(0, Math.min(Number(maxRetries ?? 2), 10));
  const effectiveApiKey = apiKey || '123';

  async function requestJson(pathname) {
    const url = new URL(pathname, normalizedBaseUrl);
    const headers = { Accept: 'application/json' };

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers,
          redirect: 'error',
          signal: AbortSignal.timeout(effectiveRequestTimeoutMs),
        });
      } catch (error) {
        if (attempt < effectiveMaxRetries) {
          await sleepImpl(computeBackoffDelay(attempt + 1, 1000));
          continue;
        }
        throw createTheAudioDbError('theaudiodb_unavailable', 'TheAudioDB request failed before receiving a response', {
          attempts: attempt + 1, cause: error, retryable: true, url: url.toString(),
        });
      }

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      if (response.status === 404) return null;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < effectiveMaxRetries) {
        const retryAfterMs = parseRetryAfterMs(response.headers?.get?.('retry-after'));
        const backoffMs = computeBackoffDelay(attempt + 1, 1000);
        await sleepImpl(retryAfterMs != null ? Math.max(backoffMs, retryAfterMs) : backoffMs);
        continue;
      }

      throw createTheAudioDbError(
        retryable ? 'theaudiodb_unavailable' : 'theaudiodb_request_failed',
        `TheAudioDB request failed with status ${response.status}`,
        { attempts: attempt + 1, retryable, status: response.status, url: url.toString() },
      );
    }

    throw createTheAudioDbError('theaudiodb_unavailable', 'TheAudioDB request exhausted retries', {
      attempts: effectiveMaxRetries + 1, retryable: true, url: url.toString(),
    });
  }

  async function fetchArtistImages({ mbid }) {
    if (typeof mbid !== 'string' || mbid.trim().length === 0) {
      throw createTheAudioDbError('theaudiodb_validation_error', 'mbid must be a non-empty string');
    }

    const data = await requestJson(`${effectiveApiKey}/artist-mb.php?i=${encodeURIComponent(mbid)}`);
    if (!data || !Array.isArray(data.artists) || data.artists.length === 0) return [];

    return selectArtistImages(data.artists[0]);
  }

  return { fetchArtistImages };
}
