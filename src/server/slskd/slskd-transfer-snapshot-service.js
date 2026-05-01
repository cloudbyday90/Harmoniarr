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

function normalizeTransferIdentifier(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function indexDownloadGroups(groups) {
  const indexedTransfers = new Map();

  for (const group of Array.isArray(groups) ? groups : []) {
    const directories = Array.isArray(group?.directories) ? group.directories : [];
    for (const directory of directories) {
      const files = Array.isArray(directory?.files) ? directory.files : [];
      for (const transfer of files) {
        const transferId = normalizeTransferIdentifier(transfer?.id);
        if (!transferId || indexedTransfers.has(transferId)) {
          continue;
        }

        indexedTransfers.set(transferId, transfer);
      }
    }
  }

  return indexedTransfers;
}

function buildEmptySnapshot() {
  return {
    getTransfer: () => null,
    requestedTransferCount: 0,
    usernameCount: 0,
  };
}

export function createSlskdTransferSnapshotService({
  getDownloads = createSlskdService().getDownloads,
} = {}) {
  async function buildTransferSnapshot({ requestedTransfers = [] } = {}) {
    const normalizedTransfers = Array.isArray(requestedTransfers)
      ? requestedTransfers.map((transfer) => ({
        id: normalizeTransferIdentifier(transfer?.id),
        username: normalizeTransferIdentifier(transfer?.username),
      })).filter((transfer) => transfer.id && transfer.username)
      : [];

    if (normalizedTransfers.length < 1) {
      return buildEmptySnapshot();
    }

    const usernames = [...new Set(normalizedTransfers.map((transfer) => transfer.username))];
    const indexedTransfersByUsername = new Map(await Promise.all(usernames.map(async (username) => ([
      username,
      indexDownloadGroups(await getDownloads({
        includeRemoved: true,
        username,
      })),
    ]))));

    return {
      getTransfer({ id, username }) {
        const normalizedId = normalizeTransferIdentifier(id);
        const normalizedUsername = normalizeTransferIdentifier(username);
        if (!normalizedId || !normalizedUsername) {
          return null;
        }

        return indexedTransfersByUsername.get(normalizedUsername)?.get(normalizedId) ?? null;
      },
      requestedTransferCount: normalizedTransfers.length,
      usernameCount: usernames.length,
    };
  }

  return {
    buildTransferSnapshot,
  };
}