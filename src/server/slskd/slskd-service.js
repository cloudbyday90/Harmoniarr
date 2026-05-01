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

import { createApiError } from '../auth.js';
import { createSlskdClient } from '../integrations/slskd/slskd-client.js';
import { observeSlskdProviderCall } from './slskd-provider-health.js';

function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'query must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'query is required');
  }

  if (normalized.length > 200) {
    throw createApiError(400, 'validation_error', 'query must be 200 characters or less');
  }

  return normalized;
}

function normalizeInteger(value, {
  fallback,
  fieldName,
  max,
  min,
}) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw createApiError(400, 'validation_error', `${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function normalizeBoolean(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw createApiError(400, 'validation_error', 'filterResponses must be a boolean');
}

function normalizeSearchId(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'searchId must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'searchId is required');
  }

  if (normalized.length > 100) {
    throw createApiError(400, 'validation_error', 'searchId must be 100 characters or less');
  }

  return normalized;
}

function normalizeServerState(payload) {
  const server = payload?.server ?? payload ?? {};
  const isConnected = server.isConnected ?? false;
  const isLoggedIn = server.isLoggedIn ?? false;
  const isTransitioning = server.isTransitioning ?? server.isConnecting ?? false;
  const status = isConnected && isLoggedIn
    ? 'healthy'
    : isConnected || isTransitioning
      ? 'degraded'
      : 'unavailable';

  return {
    provider: 'slskd',
    status,
    ...(status === 'healthy' ? {} : {
      message: isConnected
        ? 'slskd is connected but not logged in'
        : 'slskd is not connected to Soulseek',
    }),
    details: {
      isConnected,
      isLoggedIn,
      isTransitioning,
    },
    version: payload?.version?.current ?? payload?.version ?? null,
    pendingRestart: payload?.pendingRestart ?? null,
    server: {
      address: server.address ?? null,
      state: server.state ?? null,
      isConnected,
      isLoggedIn,
      isTransitioning,
    },
  };
}

function normalizeSearchFile(file) {
  return {
    filename: file.filename,
    size: file.size ?? null,
    extension: file.extension ?? null,
    bitRate: file.bitRate ?? null,
    bitDepth: file.bitDepth ?? null,
    length: file.length ?? null,
    sampleRate: file.sampleRate ?? null,
    isLocked: file.isLocked ?? false,
  };
}

function normalizeSearchResponse(response) {
  return {
    username: response.username,
    hasFreeUploadSlot: response.hasFreeUploadSlot ?? false,
    queueLength: response.queueLength ?? null,
    uploadSpeed: response.uploadSpeed ?? null,
    fileCount: response.fileCount ?? 0,
    lockedFileCount: response.lockedFileCount ?? 0,
    files: Array.isArray(response.files)
      ? response.files.map(normalizeSearchFile)
      : [],
    lockedFiles: Array.isArray(response.lockedFiles)
      ? response.lockedFiles.map(normalizeSearchFile)
      : [],
  };
}

function normalizeTransfer(transfer) {
  if (!transfer || typeof transfer !== 'object') {
    return null;
  }

  return {
    averageSpeed: transfer.averageSpeed ?? null,
    bytesTransferred: transfer.bytesTransferred ?? null,
    directory: transfer.directory ?? null,
    endedAt: transfer.endedAt ?? null,
    enqueuedAt: transfer.enqueuedAt ?? null,
    exception: transfer.exception ?? null,
    filename: transfer.filename ?? null,
    id: transfer.id ?? null,
    placeInQueue: transfer.placeInQueue ?? null,
    requestedAt: transfer.requestedAt ?? null,
    size: transfer.size ?? null,
    startedAt: transfer.startedAt ?? null,
    state: transfer.state ?? null,
    username: transfer.username ?? null,
  };
}

function normalizeDownloadDirectory(directory) {
  if (!directory || typeof directory !== 'object') {
    return null;
  }

  return {
    directory: directory.directory ?? null,
    fileCount: directory.fileCount ?? 0,
    files: Array.isArray(directory.files)
      ? directory.files.map(normalizeTransfer).filter(Boolean)
      : [],
  };
}

function normalizeDownloadGroup(group) {
  if (!group || typeof group !== 'object') {
    return null;
  }

  return {
    directories: Array.isArray(group.directories)
      ? group.directories.map(normalizeDownloadDirectory).filter(Boolean)
      : [],
    username: group.username ?? null,
  };
}

function normalizeEnqueueResult(payload) {
  const enqueued = payload?.enqueued ?? payload?.Enqueued ?? [];
  const failed = payload?.failed ?? payload?.Failed ?? [];

  return {
    enqueued: Array.isArray(enqueued)
      ? enqueued.map(normalizeTransfer).filter(Boolean)
      : [],
    failed: Array.isArray(failed)
      ? failed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [],
  };
}

function normalizeEnqueueFile(file, index) {
  const filename = typeof file?.filename === 'string' ? file.filename.trim() : '';
  if (!filename) {
    throw createApiError(400, 'validation_error', `files[${index}].filename is required`);
  }

  const size = file?.size == null || file.size === ''
    ? 0
    : normalizeInteger(file.size, {
      fallback: 0,
      fieldName: `files[${index}].size`,
      max: Number.MAX_SAFE_INTEGER,
      min: 0,
    });

  return {
    filename,
    size,
  };
}

function normalizeSearchState(payload) {
  return {
    id: payload.id,
    query: payload.searchText ?? null,
    state: payload.state ?? null,
    token: payload.token ?? null,
    isComplete: payload.isComplete ?? false,
    startedAt: payload.startedAt ?? null,
    endedAt: payload.endedAt ?? null,
    responseCount: payload.responseCount ?? 0,
    fileCount: payload.fileCount ?? 0,
    lockedFileCount: payload.lockedFileCount ?? 0,
    responses: Array.isArray(payload.responses)
      ? payload.responses.map(normalizeSearchResponse)
      : [],
  };
}

export function createSlskdService({
  providerHealthRecorder = null,
  slskdClient = createSlskdClient(),
} = {}) {
  async function getConnectionStatus() {
    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.getApplicationState(),
    );

    return normalizeServerState(payload);
  }

  async function validateAuthentication() {
    const isValid = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.isAuthenticationValid(),
    );

    return {
      provider: 'slskd',
      isValid: Boolean(isValid),
    };
  }

  async function startSearch({
    query,
    fileLimit,
    filterResponses,
    responseLimit,
    searchTimeoutMs,
  }) {
    const normalizedQuery = normalizeSearchText(query);
    const normalizedFileLimit = normalizeInteger(fileLimit, {
      fallback: 10000,
      fieldName: 'fileLimit',
      max: 50000,
      min: 1,
    });
    const normalizedResponseLimit = normalizeInteger(responseLimit, {
      fallback: 100,
      fieldName: 'responseLimit',
      max: 1000,
      min: 1,
    });
    const normalizedSearchTimeoutMs = normalizeInteger(searchTimeoutMs, {
      fallback: 15000,
      fieldName: 'searchTimeoutMs',
      max: 120000,
      min: 1000,
    });
    const normalizedFilterResponses = normalizeBoolean(filterResponses, true);

    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.startSearch({
        query: normalizedQuery,
        fileLimit: normalizedFileLimit,
        filterResponses: normalizedFilterResponses,
        responseLimit: normalizedResponseLimit,
        searchTimeoutMs: normalizedSearchTimeoutMs,
      }),
    );

    return normalizeSearchState(payload);
  }

  async function getSearchState({ searchId, includeResponses = false }) {
    const normalizedSearchId = normalizeSearchId(searchId);
    const normalizedIncludeResponses = normalizeBoolean(includeResponses, false);
    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.getSearchState({
        searchId: normalizedSearchId,
        includeResponses: normalizedIncludeResponses,
      }),
    );

    return normalizeSearchState(payload);
  }

  async function getSearchResponses({ searchId }) {
    const normalizedSearchId = normalizeSearchId(searchId);
    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.getSearchResponses({ searchId: normalizedSearchId }),
    );

    return {
      searchId: normalizedSearchId,
      responses: Array.isArray(payload)
        ? payload.map(normalizeSearchResponse)
        : [],
    };
  }

  async function enqueueDownloads({ files, username }) {
    const normalizedUsername = normalizeSearchId(username);
    const normalizedFiles = Array.isArray(files)
      ? files.map((file, index) => normalizeEnqueueFile(file, index))
      : [];

    if (normalizedFiles.length < 1) {
      throw createApiError(400, 'validation_error', 'files must include at least one download request');
    }

    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.enqueueDownloads({
        files: normalizedFiles,
        username: normalizedUsername,
      }),
    );

    return normalizeEnqueueResult(payload);
  }

  async function getDownloads({ includeRemoved = false, username } = {}) {
    const normalizedUsername = username == null || username === ''
      ? null
      : normalizeSearchId(username);
    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.getDownloads({
        includeRemoved: normalizeBoolean(includeRemoved, false),
        username: normalizedUsername,
      }),
    );

    if (normalizedUsername) {
      const groups = Array.isArray(payload) ? payload : [payload];
      return groups.map(normalizeDownloadGroup).filter(Boolean);
    }

    return Array.isArray(payload)
      ? payload.map(normalizeDownloadGroup).filter(Boolean)
      : [];
  }

  async function getDownload({ id, username }) {
    const normalizedUsername = normalizeSearchId(username);
    const normalizedId = normalizeSearchId(id);
    const payload = await observeSlskdProviderCall(
      providerHealthRecorder,
      () => slskdClient.getDownload({
        id: normalizedId,
        username: normalizedUsername,
      }),
    );

    return normalizeTransfer(payload);
  }

  return {
    enqueueDownloads,
    getConnectionStatus,
    getDownload,
    getDownloads,
    getSearchResponses,
    getSearchState,
    startSearch,
    validateAuthentication,
  };
}
