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
import {
  awaitProviderRequest,
  createProviderRequestSignal,
  throwIfProviderRequestAborted,
  waitForProviderRequestDelay,
} from '../provider-request-cancellation.js';

const NOOP_CLIENT = Object.freeze({
  getSimilarArtists: async () => [],
});

function createLastFmError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createLastFmError(
      'lastfm_misconfigured',
      `Expected a positive integer but received ${value}`,
    );
  }

  return parsed;
}

function parseNonNegativeInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createLastFmError(
      'lastfm_misconfigured',
      `Expected a non-negative integer but received ${value}`,
    );
  }

  return parsed;
}

function computeBackoffDelay(attemptNumber, minIntervalMs) {
  const boundedAttempt = Math.min(attemptNumber, 4);
  const baseDelay = minIntervalMs * (2 ** boundedAttempt);
  const jitter = Math.floor(Math.random() * 250);
  return baseDelay + jitter;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://ws.audioscrobbler.com/2.0';

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/2.0/',
      fieldName: 'LASTFM_BASE_URL',
      protocolErrorCode: 'lastfm_misconfigured',
      validationErrorCode: 'lastfm_misconfigured',
    });
  } catch {
    throw createLastFmError(
      'lastfm_misconfigured',
      `Invalid Last.fm base URL: ${candidate}`,
    );
  }
}

export function createLastFmClient({
  apiKey = process.env.LASTFM_API_KEY,
  allowedHosts = process.env.LASTFM_ALLOWED_HOSTS == null
    ? ['ws.audioscrobbler.com']
    : resolveAllowedOutboundHosts(process.env.LASTFM_ALLOWED_HOSTS, {
      envName: 'LASTFM_ALLOWED_HOSTS',
    }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(
    process.env.LASTFM_ALLOWED_HOST_SUFFIXES,
    { envName: 'LASTFM_ALLOWED_HOST_SUFFIXES' },
  ),
  baseUrl = process.env.LASTFM_BASE_URL,
  minIntervalMs = process.env.LASTFM_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.LASTFM_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.LASTFM_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  if (!apiKey) {
    return NOOP_CLIENT;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveMinIntervalMs = Math.max(parsePositiveInteger(minIntervalMs, 1000), 1000);
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 10000);
  const effectiveMaxRetries = parseNonNegativeInteger(maxRetries, 2);

  let queuedRequest = Promise.resolve();
  let nextRequestAt = 0;

  async function enqueue(operation, { signal = null } = {}) {
    const execute = async () => {
      throwIfProviderRequestAborted(signal);

      const delayMs = Math.max(0, nextRequestAt - Date.now());
      if (delayMs > 0) {
        await waitForProviderRequestDelay(delayMs, { signal, sleepImpl });
      }

      throwIfProviderRequestAborted(signal);
      nextRequestAt = Date.now() + effectiveMinIntervalMs;
      return operation();
    };

    const result = queuedRequest.then(execute, execute);
    queuedRequest = result.catch(() => {});
    return awaitProviderRequest(result, { signal });
  }

  async function requestJson(queryParams, { operation, signal = null }) {
    return enqueue(async () => {
      throwIfProviderRequestAborted(signal);

      const url = new URL(normalizedBaseUrl);
      url.searchParams.set('format', 'json');
      url.searchParams.set('api_key', apiKey);
      for (const [key, value] of Object.entries(queryParams)) {
        if (value == null || value === '') {
          continue;
        }

        url.searchParams.set(key, String(value));
      }

      for (let attempt = 0; attempt <= effectiveMaxRetries; attempt += 1) {
        throwIfProviderRequestAborted(signal);

        let response;
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            redirect: 'error',
            signal: createProviderRequestSignal({
              signal,
              timeoutMs: effectiveRequestTimeoutMs,
            }),
          });
        } catch (error) {
          throwIfProviderRequestAborted(signal);

          if (attempt < effectiveMaxRetries) {
            await waitForProviderRequestDelay(
              computeBackoffDelay(attempt + 1, effectiveMinIntervalMs),
              { signal, sleepImpl },
            );
            continue;
          }

          throw createLastFmError(
            'lastfm_unavailable',
            `Last.fm ${operation} request failed before receiving a response`,
            { attempts: attempt + 1, cause: error, maxRetries: effectiveMaxRetries, retryable: true, url: url.toString() },
          );
        }

        if (response.ok) {
          return response.json();
        }

        const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
        if (retryable && attempt < effectiveMaxRetries) {
          await waitForProviderRequestDelay(
            computeBackoffDelay(attempt + 1, effectiveMinIntervalMs),
            { signal, sleepImpl },
          );
          continue;
        }

        throw createLastFmError(
          retryable ? 'lastfm_unavailable' : 'lastfm_request_failed',
          `Last.fm ${operation} request failed with status ${response.status}`,
          { attempts: attempt + 1, maxRetries: effectiveMaxRetries, retryable, status: response.status, url: url.toString() },
        );
      }

      throw createLastFmError(
        'lastfm_unavailable',
        `Last.fm ${operation} request exhausted retries`,
        { attempts: effectiveMaxRetries + 1, maxRetries: effectiveMaxRetries, retryable: true, url: url.toString() },
      );
    }, { signal });
  }

  async function getSimilarArtists({ mbid, artistName, limit = 50, signal = null }) {
    const query = {
      method: 'artist.getsimilar',
      limit: Math.min(limit, 100),
      autocorrect: '1',
    };

    if (mbid) {
      query.mbid = mbid;
    } else if (artistName) {
      query.artist = artistName;
    } else {
      return [];
    }

    let payload;
    try {
      payload = await requestJson(query, { operation: 'similar artists', signal });
    } catch (error) {
      if (error.code === 'lastfm_request_failed') {
        return [];
      }

      throw error;
    }

    const artists = payload?.similarartists?.artist;
    if (!Array.isArray(artists)) {
      return [];
    }

    return artists.flatMap((entry) => {
      if (!entry || typeof entry.name !== 'string') {
        return [];
      }

      const entryMbid = typeof entry.mbid === 'string' && entry.mbid.length > 0
        ? entry.mbid
        : null;

      const match = typeof entry.match === 'string'
        ? Number(entry.match)
        : (typeof entry.match === 'number' ? entry.match : 0);
      const score = Number.isFinite(match) ? Math.max(0, Math.min(match, 1)) : 0;

      return [{
        mbid: entryMbid ?? entry.name.toLowerCase(),
        name: entry.name,
        score,
      }];
    });
  }

  return { getSimilarArtists };
}
