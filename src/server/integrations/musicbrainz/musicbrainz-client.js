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
    throw createMusicBrainzError(
      'musicbrainz_misconfigured',
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
    throw createMusicBrainzError(
      'musicbrainz_misconfigured',
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

function createMusicBrainzError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'https://musicbrainz.org/ws/2';

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: false,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: false,
      allowPrivateHosts: false,
      defaultPathname: '/ws/2/',
      fieldName: 'MUSICBRAINZ_BASE_URL',
      protocolErrorCode: 'musicbrainz_misconfigured',
      validationErrorCode: 'musicbrainz_misconfigured',
    });
  } catch {
    throw createMusicBrainzError(
      'musicbrainz_misconfigured',
      `Invalid MusicBrainz base URL: ${candidate}`,
    );
  }
}

function resolveUserAgent({ applicationName, applicationVersion, contactEmail, contactUrl }) {
  const contact = contactUrl ?? contactEmail ?? null;
  if (!contact) {
    throw createMusicBrainzError(
      'musicbrainz_misconfigured',
      'MusicBrainz requests require HARMONIARR_CONTACT_URL or HARMONIARR_CONTACT_EMAIL',
    );
  }

  return `${applicationName}/${applicationVersion} (${contact})`;
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

export function createMusicBrainzClient({
  allowedHosts = process.env.MUSICBRAINZ_ALLOWED_HOSTS == null
    ? ['musicbrainz.org']
    : resolveAllowedOutboundHosts(process.env.MUSICBRAINZ_ALLOWED_HOSTS, {
      envName: 'MUSICBRAINZ_ALLOWED_HOSTS',
    }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.MUSICBRAINZ_ALLOWED_HOST_SUFFIXES, {
    envName: 'MUSICBRAINZ_ALLOWED_HOST_SUFFIXES',
  }),
  baseUrl = process.env.MUSICBRAINZ_BASE_URL,
  applicationName = 'Harmoniarr',
  applicationVersion = process.env.HARMONIARR_VERSION ?? '0.1.0-beta',
  contactEmail = process.env.HARMONIARR_CONTACT_EMAIL,
  contactUrl = process.env.HARMONIARR_CONTACT_URL,
  minIntervalMs = process.env.MUSICBRAINZ_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.MUSICBRAINZ_REQUEST_TIMEOUT_MS,
  maxRetries = process.env.MUSICBRAINZ_MAX_RETRIES,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveMinIntervalMs = Math.max(parsePositiveInteger(minIntervalMs, 1100), 1000);
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 10000);
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

  async function requestJson(pathname, { query = {}, operation }) {
    return enqueue(async () => {
      const url = new URL(pathname, normalizedBaseUrl);
      url.searchParams.set('fmt', 'json');
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') {
          continue;
        }

        url.searchParams.set(key, String(value));
      }

      for (let attempt = 0; attempt <= effectiveMaxRetries; attempt += 1) {
        let response;
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': userAgent,
            },
            redirect: 'error',
            signal: AbortSignal.timeout(effectiveRequestTimeoutMs),
          });
        } catch (error) {
          if (attempt < effectiveMaxRetries) {
            await sleepImpl(computeBackoffDelay(attempt + 1, effectiveMinIntervalMs));
            continue;
          }

          throw createMusicBrainzError(
            'musicbrainz_unavailable',
            `MusicBrainz ${operation} request failed before receiving a response`,
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
          return response.json();
        }

        if (response.status === 404) {
          throw createMusicBrainzError(
            'musicbrainz_not_found',
            `MusicBrainz ${operation} not found`,
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
        const retryAfterMs = parseRetryAfterMs(getHeader(response, 'retry-after'));
        const throttled = response.status === 429 || response.status === 503;
        if (retryable && attempt < effectiveMaxRetries) {
          const backoffDelayMs = computeBackoffDelay(attempt + 1, effectiveMinIntervalMs);
          await sleepImpl(retryAfterMs == null ? backoffDelayMs : Math.max(backoffDelayMs, retryAfterMs));
          continue;
        }

        throw createMusicBrainzError(
          retryable ? 'musicbrainz_unavailable' : 'musicbrainz_request_failed',
          `MusicBrainz ${operation} request failed with status ${response.status}`,
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

      throw createMusicBrainzError(
        'musicbrainz_unavailable',
        `MusicBrainz ${operation} request exhausted retries`,
        buildFailureDetails({
          attempts: effectiveMaxRetries + 1,
          maxRetries: effectiveMaxRetries,
          retryable: true,
          url: url.toString(),
        }),
      );
    });
  }

  async function lookupArtist({ artistId, includeAliases = true }) {
    return requestJson(`artist/${artistId}`, {
      operation: 'artist lookup',
      query: {
        inc: includeAliases ? 'aliases' : null,
      },
    });
  }

  async function lookupArtistRelations({ artistId }) {
    return requestJson(`artist/${artistId}`, {
      operation: 'artist relations lookup',
      query: {
        inc: 'artist-rels',
      },
    });
  }

  async function lookupRelease({ releaseId }) {
    return requestJson(`release/${releaseId}`, {
      operation: 'release lookup',
      query: {
        inc: 'artist-credits+recordings+release-groups+media',
      },
    });
  }

  async function lookupReleaseGroup({ releaseGroupId }) {
    return requestJson(`release-group/${releaseGroupId}`, {
      operation: 'release-group lookup',
      query: {
        inc: 'artist-credits+releases',
      },
    });
  }

  async function searchArtists({ query, limit = 10, offset = 0, dismax = false }) {
    return requestJson('artist', {
      operation: 'artist search',
      query: {
        query,
        limit,
        offset,
        dismax: dismax ? 'true' : null,
      },
    });
  }

  async function searchReleases({ query, limit = 10, offset = 0, dismax = false }) {
    return requestJson('release', {
      operation: 'release search',
      query: {
        query,
        limit,
        offset,
        dismax: dismax ? 'true' : null,
      },
    });
  }

  async function browseArtistReleaseGroups({
    artistId,
    limit = 25,
    offset = 0,
    type = null,
    releaseGroupStatus = 'website-default',
  }) {
    return requestJson('release-group', {
      operation: 'artist release-group browse',
      query: {
        artist: artistId,
        limit,
        offset,
        type,
        'release-group-status': releaseGroupStatus,
        inc: 'artist-credits',
      },
    });
  }

  async function browseReleaseGroupReleases({
    releaseGroupId,
    limit = 25,
    offset = 0,
  }) {
    return requestJson('release', {
      operation: 'release-group release browse',
      query: {
        'release-group': releaseGroupId,
        limit,
        offset,
        inc: 'artist-credits+media',
      },
    });
  }

  return {
    browseArtistReleaseGroups,
    browseReleaseGroupReleases,
    lookupArtist,
    lookupArtistRelations,
    lookupReleaseGroup,
    lookupRelease,
    searchArtists,
    searchReleases,
  };
}
