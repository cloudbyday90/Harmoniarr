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
  throwIfProviderRequestAborted,
  waitForProviderRequestDelay,
} from '../provider-request-cancellation.js';
import { createMusicBrainzRequestService } from './musicbrainz-request-service.js';
import { resolveMusicBrainzRequestPolicy } from './musicbrainz-request-policy.js';

// Last-resort contact used in the User-Agent when no HARMONIARR_CONTACT_URL or
// HARMONIARR_CONTACT_EMAIL is configured. Operators are encouraged to override
// this with their own contact, but this keeps the provider usable out of the box.
const DEFAULT_CONTACT_URL = 'https://github.com/cloudbyday90/harmoniarr';

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
      'Invalid MusicBrainz base URL',
    );
  }
}

function resolveUserAgent({ applicationName, applicationVersion, contactEmail, contactUrl }) {
  // MusicBrainz only requires that the User-Agent carry a reachable contact for
  // the operator. Prefer an explicitly configured contact, but fall back to the
  // project URL so a missing HARMONIARR_CONTACT_* env var degrades to a valid,
  // reachable identifier instead of disabling the provider entirely.
  const contact = contactUrl ?? contactEmail ?? DEFAULT_CONTACT_URL;

  return `${applicationName}/${applicationVersion} (${contact})`;
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
  let requestPolicy;
  try {
    requestPolicy = resolveMusicBrainzRequestPolicy({
      maxRetries,
      minIntervalMs,
      requestTimeoutMs,
    });
  } catch {
    throw createMusicBrainzError('musicbrainz_misconfigured', 'Invalid MusicBrainz request policy');
  }
  const {
    maxRetries: effectiveMaxRetries,
    minIntervalMs: effectiveMinIntervalMs,
    requestTimeoutMs: effectiveRequestTimeoutMs,
  } = requestPolicy;
  const userAgent = resolveUserAgent({
    applicationName,
    applicationVersion,
    contactEmail,
    contactUrl,
  });

  const requestService = createMusicBrainzRequestService({
    fetchImpl, sleepImpl, requestTimeoutMs: effectiveRequestTimeoutMs,
    maxRetries: effectiveMaxRetries, minIntervalMs: effectiveMinIntervalMs, userAgent,
  });

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

  async function requestJson(pathname, { query = {}, operation, signal = null }) {
    return enqueue(async () => {
      throwIfProviderRequestAborted(signal);

      const url = new URL(pathname, normalizedBaseUrl);
      url.searchParams.set('fmt', 'json');
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') {
          continue;
        }

        url.searchParams.set(key, String(value));
      }

      return requestService.requestJson(url, { operation, signal });
    }, { signal });
  }

  async function lookupArtist({ artistId, includeAliases = true, signal = null }) {
    return requestJson(`artist/${artistId}`, {
      operation: 'artist lookup',
      signal,
      query: {
        inc: includeAliases ? 'aliases' : null,
      },
    });
  }

  async function lookupArtistRelations({ artistId, signal = null }) {
    return requestJson(`artist/${artistId}`, {
      operation: 'artist relations lookup',
      signal,
      query: {
        inc: 'artist-rels+genres+tags',
      },
    });
  }

  async function lookupRelease({ releaseId, signal = null }) {
    return requestJson(`release/${releaseId}`, {
      operation: 'release lookup',
      signal,
      query: {
        inc: 'artist-credits+recordings+release-groups+media',
      },
    });
  }

  async function lookupReleaseGroup({ releaseGroupId, signal = null }) {
    return requestJson(`release-group/${releaseGroupId}`, {
      operation: 'release-group lookup',
      signal,
      query: {
        inc: 'artist-credits+releases',
      },
    });
  }

  async function searchArtists({ query, limit = 10, offset = 0, dismax = false, signal = null }) {
    return requestJson('artist', {
      operation: 'artist search',
      signal,
      query: {
        query,
        limit,
        offset,
        dismax: dismax ? 'true' : null,
      },
    });
  }

  async function searchReleases({ query, limit = 10, offset = 0, dismax = false, signal = null }) {
    return requestJson('release', {
      operation: 'release search',
      signal,
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
    signal = null,
  }) {
    return requestJson('release-group', {
      operation: 'artist release-group browse',
      signal,
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
    signal = null,
  }) {
    return requestJson('release', {
      operation: 'release-group release browse',
      signal,
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
