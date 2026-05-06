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

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createListenBrainzError(
      'listenbrainz_misconfigured',
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
    throw createListenBrainzError(
      'listenbrainz_misconfigured',
      `Expected a non-negative integer but received ${value}`,
    );
  }

  return parsed;
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createListenBrainzError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://api.listenbrainz.org';

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/',
      fieldName: 'LISTENBRAINZ_BASE_URL',
      protocolErrorCode: 'listenbrainz_misconfigured',
      validationErrorCode: 'listenbrainz_misconfigured',
    });
  } catch {
    throw createListenBrainzError(
      'listenbrainz_misconfigured',
      `Invalid ListenBrainz base URL: ${candidate}`,
    );
  }
}

function computeBackoffDelay(attemptNumber, minIntervalMs) {
  const boundedAttempt = Math.min(attemptNumber, 4);
  const baseDelay = minIntervalMs * (2 ** boundedAttempt);
  const jitter = Math.floor(Math.random() * 250);
  return baseDelay + jitter;
}

function getHeader(response, headerName) {
  if (!response.headers?.get) {
    return null;
  }

  return response.headers.get(headerName);
}

function buildFailureDetails({
  cause,
  maxRetries,
  retryable,
  status = null,
  throttled = false,
  url,
  attempts,
}) {
  return {
    attempts,
    cause,
    maxRetries,
    retryable,
    status,
    throttled,
    url,
  };
}

// Parses X-RateLimit-Reset-In header value to milliseconds.
// The header is a number of seconds (may be fractional).
function parseRateLimitResetInMs(value) {
  if (value == null || value === '') {
    return null;
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return Math.ceil(seconds * 1000);
}

export function createListenBrainzClient({
  allowedHosts = process.env.LISTENBRAINZ_ALLOWED_HOSTS == null
    ? ['api.listenbrainz.org']
    : resolveAllowedOutboundHosts(process.env.LISTENBRAINZ_ALLOWED_HOSTS, {
      envName: 'LISTENBRAINZ_ALLOWED_HOSTS',
    }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(
    process.env.LISTENBRAINZ_ALLOWED_HOST_SUFFIXES,
    { envName: 'LISTENBRAINZ_ALLOWED_HOST_SUFFIXES' },
  ),
  baseUrl = process.env.LISTENBRAINZ_BASE_URL,
  minIntervalMs = process.env.LISTENBRAINZ_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.LISTENBRAINZ_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.LISTENBRAINZ_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveMinIntervalMs = Math.max(parsePositiveInteger(minIntervalMs, 1000), 1000);
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 10000);
  const effectiveMaxRetries = parseNonNegativeInteger(maxRetries, 2);

  let queuedRequest = Promise.resolve();
  let nextRequestAt = 0;
  // Tracks when the rate limit window resets; updated from X-RateLimit-Reset-In.
  let rateLimitResetAt = 0;

  async function enqueue(operation) {
    const execute = async () => {
      const spacingDelay = Math.max(0, nextRequestAt - Date.now());
      const rateLimitDelay = Math.max(0, rateLimitResetAt - Date.now());
      const delayMs = Math.max(spacingDelay, rateLimitDelay);
      if (delayMs > 0) {
        await sleepImpl(delayMs);
      }

      nextRequestAt = Date.now() + effectiveMinIntervalMs;
      return operation();
    };

    const result = queuedRequest.then(execute, execute);
    queuedRequest = result.catch(() => {});
    return result;
  }

  // Inspects rate-limit headers from any successful response and updates
  // rateLimitResetAt when the remaining budget is exhausted.
  function consumeRateLimitHeaders(response) {
    const remaining = getHeader(response, 'x-ratelimit-remaining');
    if (remaining !== '0') {
      return;
    }

    const resetInMs = parseRateLimitResetInMs(getHeader(response, 'x-ratelimit-reset-in'));
    if (resetInMs != null && resetInMs > 0) {
      rateLimitResetAt = Date.now() + resetInMs;
    }
  }

  async function requestJson(pathname, { operation }) {
    return enqueue(async () => {
      const url = new URL(pathname, normalizedBaseUrl);

      for (let attempt = 0; attempt <= effectiveMaxRetries; attempt += 1) {
        let response;
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            redirect: 'error',
            signal: AbortSignal.timeout(effectiveRequestTimeoutMs),
          });
        } catch (error) {
          if (attempt < effectiveMaxRetries) {
            await sleepImpl(computeBackoffDelay(attempt + 1, effectiveMinIntervalMs));
            continue;
          }

          throw createListenBrainzError(
            'listenbrainz_unavailable',
            `ListenBrainz ${operation} request failed before receiving a response`,
            buildFailureDetails({
              attempts: attempt + 1,
              cause: error,
              maxRetries: effectiveMaxRetries,
              retryable: true,
              url: url.toString(),
            }),
          );
        }

        consumeRateLimitHeaders(response);

        if (response.ok) {
          return response.json();
        }

        if (response.status === 404) {
          throw createListenBrainzError(
            'listenbrainz_not_found',
            `ListenBrainz ${operation} not found`,
            buildFailureDetails({
              attempts: attempt + 1,
              maxRetries: effectiveMaxRetries,
              retryable: false,
              status: response.status,
              url: url.toString(),
            }),
          );
        }

        const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
        const throttled = response.status === 429;

        if (response.status === 429) {
          const resetInMs = parseRateLimitResetInMs(getHeader(response, 'x-ratelimit-reset-in'));
          if (resetInMs != null && resetInMs > 0) {
            rateLimitResetAt = Date.now() + resetInMs;
          }
        }

        if (retryable && attempt < effectiveMaxRetries) {
          await sleepImpl(computeBackoffDelay(attempt + 1, effectiveMinIntervalMs));
          continue;
        }

        throw createListenBrainzError(
          retryable ? 'listenbrainz_unavailable' : 'listenbrainz_request_failed',
          `ListenBrainz ${operation} request failed with status ${response.status}`,
          buildFailureDetails({
            attempts: attempt + 1,
            maxRetries: effectiveMaxRetries,
            retryable,
            status: response.status,
            throttled,
            url: url.toString(),
          }),
        );
      }

      throw createListenBrainzError(
        'listenbrainz_unavailable',
        `ListenBrainz ${operation} request exhausted retries`,
        buildFailureDetails({
          attempts: effectiveMaxRetries + 1,
          maxRetries: effectiveMaxRetries,
          retryable: true,
          url: url.toString(),
        }),
      );
    });
  }

  // GET /1/popularity/similar-to-artist/{artist_mbid}
  //
  // Returns an array of similar artists with similarity scores. Returns an
  // empty array if the endpoint responds with 404 (endpoint may be unavailable
  // or not yet released for a given MBID).
  //
  // Response format normalisation: the endpoint may return items directly as
  // an array, or wrapped in a { payload: [...] } envelope. Both shapes are
  // handled transparently.
  async function getSimilarArtists({ mbid, limit = 50 }) {
    let payload;
    try {
      payload = await requestJson(`1/popularity/similar-to-artist/${encodeURIComponent(mbid)}`, {
        operation: 'similar artists',
      });
    } catch (error) {
      if (error.code === 'listenbrainz_not_found') {
        return [];
      }

      throw error;
    }

    const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.payload) ? payload.payload : []);

    return items
      .slice(0, limit)
      .flatMap((item) => {
        if (typeof item?.artist_mbid !== 'string' || item.artist_mbid.length === 0) {
          return [];
        }

        return [{
          mbid: item.artist_mbid,
          name: typeof item.artist_name === 'string' ? item.artist_name : null,
          score: typeof item.score === 'number' ? item.score : 0,
        }];
      });
  }

  return { getSimilarArtists };
}
