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

function createFanartTvError(code, message, details = {}) {
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
    throw createFanartTvError('fanarttv_misconfigured', `Expected a positive integer but received ${value}`);
  }
  return parsed;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://webservice.fanart.tv/v3.2';
  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/v3.2/',
      fieldName: 'FANARTTV_BASE_URL',
      protocolErrorCode: 'fanarttv_misconfigured',
      validationErrorCode: 'fanarttv_misconfigured',
    });
  } catch {
    throw createFanartTvError('fanarttv_misconfigured', `Invalid Fanart.tv base URL: ${candidate}`);
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

const artistImageTypes = ['artistthumb', 'artistbackground', 'hdmusiclogo', 'musiclogo'];
const albumImageTypes = ['albumcover'];

function selectBestImage(images, imageType) {
  const list = images?.[imageType];
  if (!Array.isArray(list) || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
  const preferred = sorted.find((img) => img.lang === '' || img.lang == null) ?? sorted[0];
  return preferred ?? null;
}

export function selectArtistImages(response) {
  if (!response || typeof response !== 'object') return [];
  const results = [];
  for (const imageType of artistImageTypes) {
    const image = selectBestImage(response, imageType);
    if (image) results.push({ imageType, url: image.url, id: image.id, likes: Number(image.likes) || 0 });
  }
  return results;
}

export function selectAlbumImages(response) {
  if (!response || typeof response !== 'object') return [];
  const results = [];
  for (const imageType of albumImageTypes) {
    const image = selectBestImage(response, imageType);
    if (image) results.push({ imageType, url: image.url, id: image.id, likes: Number(image.likes) || 0 });
  }
  return results;
}

export function createFanartTvClient({
  allowedHosts = process.env.FANARTTV_ALLOWED_HOSTS == null
    ? ['fanart.tv', 'webservice.fanart.tv']
    : resolveAllowedOutboundHosts(process.env.FANARTTV_ALLOWED_HOSTS, { envName: 'FANARTTV_ALLOWED_HOSTS' }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.FANARTTV_ALLOWED_HOST_SUFFIXES, {
    envName: 'FANARTTV_ALLOWED_HOST_SUFFIXES',
  }),
  baseUrl = process.env.FANARTTV_BASE_URL,
  requestTimeoutMs = process.env.FANARTTV_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.FANARTTV_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
  resolveApiKey = async () => null,
  resolveClientKey = async () => null,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 15000);
  const effectiveMaxRetries = Math.max(0, Math.min(Number(maxRetries ?? 2), 10));

  async function buildHeaders() {
    const headers = { Accept: 'application/json' };
    const clientKey = await resolveClientKey();
    const apiKey = await resolveApiKey();
    if (clientKey) headers['client-key'] = clientKey;
    if (apiKey) headers['api-key'] = apiKey;
    return headers;
  }

  async function requestJson(pathname) {
    const url = new URL(pathname, normalizedBaseUrl);
    const headers = await buildHeaders();

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
        throw createFanartTvError('fanarttv_unavailable', 'Fanart.tv request failed before receiving a response', {
          attempts: attempt + 1, cause: error, retryable: true, url: url.toString(),
        });
      }

      if (response.ok) return response.json();

      if (response.status === 404) return null;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < effectiveMaxRetries) {
        const retryAfterMs = parseRetryAfterMs(response.headers?.get?.('retry-after'));
        const backoffMs = computeBackoffDelay(attempt + 1, 1000);
        await sleepImpl(retryAfterMs != null ? Math.max(backoffMs, retryAfterMs) : backoffMs);
        continue;
      }

      throw createFanartTvError(
        retryable ? 'fanarttv_unavailable' : 'fanarttv_request_failed',
        `Fanart.tv request failed with status ${response.status}`,
        { attempts: attempt + 1, retryable, status: response.status, url: url.toString() },
      );
    }

    throw createFanartTvError('fanarttv_unavailable', 'Fanart.tv request exhausted retries', {
      attempts: effectiveMaxRetries + 1, retryable: true, url: url.toString(),
    });
  }

  async function fetchArtistImages({ mbid }) {
    if (typeof mbid !== 'string' || mbid.trim().length === 0) {
      throw createFanartTvError('fanarttv_validation_error', 'mbid must be a non-empty string');
    }

    const response = await requestJson(`music/${mbid}`);
    if (!response) return [];
    return selectArtistImages(response);
  }

  async function fetchAlbumImages({ mbid }) {
    if (typeof mbid !== 'string' || mbid.trim().length === 0) {
      throw createFanartTvError('fanarttv_validation_error', 'mbid must be a non-empty string');
    }

    const response = await requestJson(`music/albums/${mbid}`);
    if (!response) return [];
    return selectAlbumImages(response);
  }

  return { fetchAlbumImages, fetchArtistImages };
}
