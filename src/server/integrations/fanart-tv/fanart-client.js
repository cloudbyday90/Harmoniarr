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
import { createFanartTvRequestService } from './fanart-request-service.js';
import { resolveFanartTvRequestPolicy } from './fanart-request-policy.js';

function createFanartTvError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => { setTimeout(resolve, delayMs); });
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
    throw createFanartTvError('fanarttv_misconfigured', 'Invalid Fanart.tv base URL');
  }
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
  let requestPolicy;
  try { requestPolicy = resolveFanartTvRequestPolicy({ requestTimeoutMs, maxRetries }); }
  catch { throw createFanartTvError('fanarttv_misconfigured', 'Invalid Fanart.tv request policy'); }
  const requests = createFanartTvRequestService({ fetchImpl, sleepImpl, ...requestPolicy });

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
    let headers;
    try { headers = await buildHeaders(); }
    catch {
      throw Object.assign(createFanartTvError('fanarttv_unavailable', 'Fanart.tv credentials could not be resolved',
        { attempts: 0, retryable: false, status: null }), { diagnosticCode: 'credentials_unavailable' });
    }
    return requests.requestJson(url, { headers });
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
