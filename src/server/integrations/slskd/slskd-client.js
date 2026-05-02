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
    throw createSlskdError(
      'slskd_misconfigured',
      `Expected a positive integer but received ${value}`,
    );
  }

  return parsed;
}

function createSlskdError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeBaseUrl(value, { allowedHosts, allowedHostSuffixes }) {
  const candidate = value ?? 'http://slskd:5030';

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: true,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: true,
      allowPrivateHosts: true,
      defaultPathname: '/api/v0/',
      fieldName: 'SLSKD_BASE_URL',
      protocolErrorCode: 'slskd_misconfigured',
      validationErrorCode: 'slskd_misconfigured',
    });
  } catch {
    throw createSlskdError(
      'slskd_misconfigured',
      `Invalid slskd base URL: ${candidate}`,
    );
  }
}

function normalizeEnqueueRequests(files) {
  const normalizedFiles = Array.isArray(files) ? files : [];
  if (normalizedFiles.length < 1) {
    throw createSlskdError(
      'slskd_misconfigured',
      'Expected at least one file to enqueue',
    );
  }

  return normalizedFiles.map((file) => {
    const filename = typeof file?.filename === 'string' ? file.filename.trim() : '';
    if (!filename) {
      throw createSlskdError(
        'slskd_misconfigured',
        'Expected each enqueue file to include a filename',
      );
    }

    return {
      filename,
      size: Number.isFinite(file?.size) ? file.size : 0,
    };
  });
}

function buildFailureDetails({
  cause,
  operation,
  retryable,
  status = null,
  url,
}) {
  return {
    cause,
    operation,
    retryable,
    status,
    url,
  };
}

export function createSlskdClient({
  apiKey = process.env.SLSKD_API_KEY,
  allowedHosts = resolveAllowedOutboundHosts(process.env.SLSKD_ALLOWED_HOSTS, {
    envName: 'SLSKD_ALLOWED_HOSTS',
  }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.SLSKD_ALLOWED_HOST_SUFFIXES, {
    envName: 'SLSKD_ALLOWED_HOST_SUFFIXES',
  }),
  baseUrl = process.env.SLSKD_BASE_URL,
  fetchImpl = fetch,
  requestTimeoutMs = process.env.SLSKD_REQUEST_TIMEOUT_MS,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowedHosts, allowedHostSuffixes });
  const effectiveRequestTimeoutMs = parsePositiveInteger(requestTimeoutMs, 10000);

  async function requestJson(pathname, {
    body,
    method = 'GET',
    operation,
    query = {},
  }) {
    const url = new URL(pathname, normalizedBaseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    const headers = {
      Accept: 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    };

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(effectiveRequestTimeoutMs),
        ...(body == null ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw createSlskdError(
        'slskd_unavailable',
        `slskd ${operation} request failed before receiving a response`,
        buildFailureDetails({
          cause: error,
          operation,
          retryable: true,
          url: url.toString(),
        }),
      );
    }

    if (response.ok) {
      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    if (response.status === 401 || response.status === 403) {
      throw createSlskdError(
        'slskd_unauthorized',
        `slskd ${operation} request was not authorized`,
        buildFailureDetails({
          operation,
          retryable: false,
          status: response.status,
          url: url.toString(),
        }),
      );
    }

    const retryable = response.status === 429 || response.status >= 500;
    throw createSlskdError(
      retryable ? 'slskd_unavailable' : 'slskd_request_failed',
      `slskd ${operation} request failed with status ${response.status}`,
      buildFailureDetails({
        operation,
        retryable,
        status: response.status,
        url: url.toString(),
      }),
    );
  }

  function getApplicationState() {
    return requestJson('application', {
      operation: 'application state',
    });
  }

  function getServerState() {
    return requestJson('server', {
      operation: 'server state',
    });
  }

  function isAuthenticationValid() {
    return requestJson('session', {
      operation: 'session validation',
    });
  }

  function startSearch({
    id = null,
    query,
    fileLimit = 10000,
    filterResponses = true,
    maximumPeerQueueLength = 1000000,
    minimumPeerUploadSpeed = 0,
    minimumResponseFileCount = 1,
    responseLimit = 100,
    searchTimeoutMs = 15000,
  }) {
    return requestJson('searches', {
      method: 'POST',
      operation: 'search start',
      body: {
        id,
        searchText: query,
        fileLimit,
        filterResponses,
        maximumPeerQueueLength,
        minimumPeerUploadSpeed,
        minimumResponseFileCount,
        responseLimit,
        searchTimeout: searchTimeoutMs,
      },
    });
  }

  function getSearchState({ searchId, includeResponses = false }) {
    return requestJson(`searches/${encodeURIComponent(searchId)}`, {
      operation: 'search state',
      query: {
        includeResponses,
      },
    });
  }

  function getSearchResponses({ searchId }) {
    return requestJson(`searches/${encodeURIComponent(searchId)}/responses`, {
      operation: 'search responses',
    });
  }

  function getDownloads({ includeRemoved = false, username } = {}) {
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const pathname = normalizedUsername
      ? `transfers/downloads/${encodeURIComponent(normalizedUsername)}`
      : 'transfers/downloads';

    return requestJson(pathname, {
      operation: 'download list',
      query: normalizedUsername
        ? {}
        : { includeRemoved },
    });
  }

  function getDownload({ id, username }) {
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedId = typeof id === 'string' ? id.trim() : '';

    if (!normalizedUsername) {
      throw createSlskdError(
        'slskd_misconfigured',
        'Expected a username when reading a download transfer',
      );
    }

    if (!normalizedId) {
      throw createSlskdError(
        'slskd_misconfigured',
        'Expected a transfer id when reading a download transfer',
      );
    }

    return requestJson(`transfers/downloads/${encodeURIComponent(normalizedUsername)}/${encodeURIComponent(normalizedId)}`, {
      operation: 'download detail',
    });
  }

  function enqueueDownloads({ files, username }) {
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    if (!normalizedUsername) {
      throw createSlskdError(
        'slskd_misconfigured',
        'Expected a username when enqueueing downloads',
      );
    }

    return requestJson(`transfers/downloads/${encodeURIComponent(normalizedUsername)}`, {
      method: 'POST',
      operation: 'download enqueue',
      body: normalizeEnqueueRequests(files),
    });
  }

  function stopSearch({ searchId }) {
    return requestJson(`searches/${encodeURIComponent(searchId)}`, {
      method: 'PUT',
      operation: 'search stop',
    });
  }

  function deleteSearch({ searchId }) {
    return requestJson(`searches/${encodeURIComponent(searchId)}`, {
      method: 'DELETE',
      operation: 'search delete',
    });
  }

  return {
    enqueueDownloads,
    deleteSearch,
    getApplicationState,
    getDownload,
    getDownloads,
    getSearchResponses,
    getSearchState,
    getServerState,
    isAuthenticationValid,
    startSearch,
    stopSearch,
  };
}
