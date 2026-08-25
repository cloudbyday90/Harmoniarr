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

import { createSlskdService } from './slskd-service.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRemoteFilename(value) {
  return normalizeString(value).replaceAll('/', '\\');
}

function normalizeSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : 0;
}

function buildRequestedFileKey(file) {
  const filename = normalizeRemoteFilename(file?.filename);
  return filename ? `${filename}\u0000${normalizeSize(file?.size)}` : '';
}

function flattenDownloadGroups(groups, username) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => (
    (Array.isArray(group?.directories) ? group.directories : []).flatMap((directory) => {
      const groupUsername = normalizeString(group?.username) || username;
      return (Array.isArray(directory?.files) ? directory.files : []).map((transfer) => ({
        ...transfer,
        username: normalizeString(transfer?.username) || groupUsername,
      }));
    })
  ));
}

/**
 * Looks for an already-accepted slskd request after Harmoniarr loses the POST
 * response. slskd does not provide a client idempotency key for enqueue, so
 * this proof is intentionally exact: remote filename and byte size must both
 * match before a prior request is treated as accepted.
 */
export function createSlskdDownloadHandoffReconciliationService({
  getDownloads = createSlskdService().getDownloads,
} = {}) {
  async function findMatchingTransfers({ requestedFiles = [], username } = {}) {
    const normalizedUsername = normalizeString(username);
    const expectedFiles = Array.isArray(requestedFiles)
      ? requestedFiles.map((file) => ({
        filename: normalizeRemoteFilename(file?.filename),
        size: normalizeSize(file?.size),
      })).filter((file) => file.filename)
      : [];

    if (!normalizedUsername || expectedFiles.length < 1) {
      return {
        allRequestedFilesMatched: false,
        matchedTransfers: [],
        missingFiles: expectedFiles,
        requestedFileCount: expectedFiles.length,
      };
    }

    const transfers = flattenDownloadGroups(await getDownloads({
      includeRemoved: true,
      username: normalizedUsername,
    }), normalizedUsername).filter((transfer) => transfer.username === normalizedUsername);
    const transfersByKey = new Map();

    for (const transfer of transfers) {
      const key = buildRequestedFileKey(transfer);
      if (!key) {
        continue;
      }

      const matches = transfersByKey.get(key) ?? [];
      matches.push(transfer);
      transfersByKey.set(key, matches);
    }

    const matchedTransfers = [];
    const missingFiles = [];
    for (const requestedFile of expectedFiles) {
      const matches = transfersByKey.get(buildRequestedFileKey(requestedFile)) ?? [];
      const transfer = matches.shift() ?? null;
      if (transfer) {
        matchedTransfers.push(transfer);
      } else {
        missingFiles.push(requestedFile);
      }
    }

    return {
      allRequestedFilesMatched: missingFiles.length === 0,
      matchedTransfers,
      missingFiles,
      requestedFileCount: expectedFiles.length,
    };
  }

  return {
    findMatchingTransfers,
  };
}
