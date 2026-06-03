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

// Last-resort contact used in the User-Agent when no HARMONIARR_CONTACT_URL or
// HARMONIARR_CONTACT_EMAIL is configured. Operators are encouraged to override
// this with their own contact, but this keeps artwork fetches usable out of the box.
const DEFAULT_CONTACT_URL = 'https://github.com/cloudbyday90/harmoniarr';

function createCoverArtArchiveError(code, message, details = {}) {
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
    throw createCoverArtArchiveError(
      'coverartarchive_misconfigured',
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
    throw createCoverArtArchiveError(
      'coverartarchive_misconfigured',
      `Expected a non-negative integer but received ${value}`,
    );
  }

  return parsed;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://coverartarchive.org';

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/',
      fieldName: 'COVERARTARCHIVE_BASE_URL',
      protocolErrorCode: 'coverartarchive_misconfigured',
      validationErrorCode: 'coverartarchive_misconfigured',
    });
  } catch {
    throw createCoverArtArchiveError(
      'coverartarchive_misconfigured',
      `Invalid Cover Art Archive base URL: ${candidate}`,
    );
  }
}

function resolveUserAgent({ applicationName, applicationVersion, contactEmail, contactUrl }) {
  // Cover Art Archive shares MusicBrainz's User-Agent contact requirement.
  // Prefer an explicit contact, but fall back to the project URL so a missing
  // HARMONIARR_CONTACT_* env var degrades to a valid, reachable identifier
  // instead of disabling artwork fetches entirely.
  const contact = contactUrl ?? contactEmail ?? DEFAULT_CONTACT_URL;

  return `${applicationName}/${applicationVersion} (${contact})`;
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value == null || value === '') {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }

  return null;
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
  retryAfterMs = null,
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
    retryAfterMs,
    status,
    throttled,
    url,
  };
}

export function createCoverArtArchiveClient({
  allowedHosts = process.env.COVERARTARCHIVE_ALLOWED_HOSTS == null
    ? ['coverartarchive.org', 'archive.org']
    : resolveAllowedOutboundHosts(process.env.COVERARTARCHIVE_ALLOWED_HOSTS, {
      envName: 'COVERARTARCHIVE_ALLOWED_HOSTS',
    }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.COVERARTARCHIVE_ALLOWED_HOST_SUFFIXES, {
    envName: 'COVERARTARCHIVE_ALLOWED_HOST_SUFFIXES',
  }),
  baseUrl = process.env.COVERARTARCHIVE_BASE_URL,
  applicationName = 'Harmoniarr',
  applicationVersion = process.env.HARMONIARR_VERSION ?? '0.1.0-beta',
  contactEmail = process.env.HARMONIARR_CONTACT_EMAIL,
  contactUrl = process.env.HARMONIARR_CONTACT_URL,
  minIntervalMs = process.env.COVERARTARCHIVE_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.COVERARTARCHIVE_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.COVERARTARCHIVE_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveMinIntervalMs = Math.max(parsePositiveInteger(minIntervalMs, 1100), 1000);
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 15000);
  const effectiveMaxRetries = parseNonNegativeInteger(maxRetries, 2);
  const userAgent = resolveUserAgent({
    applicationName,
    applicationVersion,
    contactEmail,
    contactUrl,
  });

  let queuedRequest = Promise.resolve();
  let nextRequestAt = 0;

  async function enqueue(operation) {
    const execute = async () => {
      const delayMs = Math.max(0, nextRequestAt - Date.now());
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

  async function fetchFrontImage({ mbid, mbidType = 'release' }) {
    if (typeof mbid !== 'string' || mbid.trim().length === 0) {
      throw createCoverArtArchiveError(
        'coverartarchive_validation_error',
        'mbid must be a non-empty string',
      );
    }

    const pathSegment = mbidType === 'release-group' ? 'release-group' : 'release';
    const pathname = `/${pathSegment}/${mbid}/front`;

    return enqueue(async () => {
      const url = new URL(pathname, normalizedBaseUrl);

      for (let attempt = 0; attempt <= effectiveMaxRetries; attempt += 1) {
        let response;
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            headers: {
              'User-Agent': userAgent,
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(effectiveRequestTimeoutMs),
          });
        } catch (error) {
          if (attempt < effectiveMaxRetries) {
            await sleepImpl(computeBackoffDelay(attempt + 1, effectiveMinIntervalMs));
            continue;
          }

          throw createCoverArtArchiveError(
            'coverartarchive_unavailable',
            `Cover Art Archive front image request failed before receiving a response`,
            buildFailureDetails({
              attempts: attempt + 1,
              cause: error,
              maxRetries: effectiveMaxRetries,
              retryable: true,
              url: url.toString(),
            }),
          );
        }

        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') ?? 'image/jpeg';
          return {
            buffer,
            contentType,
            sourceUrl: response.url,
          };
        }

        if (response.status === 400 || response.status === 404) {
          return null;
        }

        const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
        const retryAfterMs = parseRetryAfterMs(getHeader(response, 'retry-after'));
        const throttled = response.status === 429 || response.status === 503;

        if (retryable && attempt < effectiveMaxRetries) {
          const backoffDelayMs = computeBackoffDelay(attempt + 1, effectiveMinIntervalMs);
          await sleepImpl(retryAfterMs == null ? backoffDelayMs : Math.max(backoffDelayMs, retryAfterMs));
          continue;
        }

        throw createCoverArtArchiveError(
          retryable ? 'coverartarchive_unavailable' : 'coverartarchive_request_failed',
          `Cover Art Archive request failed with status ${response.status}`,
          buildFailureDetails({
            attempts: attempt + 1,
            maxRetries: effectiveMaxRetries,
            retryable,
            retryAfterMs,
            status: response.status,
            throttled,
            url: url.toString(),
          }),
        );
      }

      throw createCoverArtArchiveError(
        'coverartarchive_unavailable',
        'Cover Art Archive request exhausted retries',
        buildFailureDetails({
          attempts: effectiveMaxRetries + 1,
          maxRetries: effectiveMaxRetries,
          retryable: true,
          url: url.toString(),
        }),
      );
    });
  }

  return { fetchFrontImage };
}
