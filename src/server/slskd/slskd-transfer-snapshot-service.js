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
import { normalizeDownloadTransferId } from './slskd-download-attempt-policy.js';

function normalizeTransferIdentifier(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTransferId(value) {
  const id = normalizeTransferIdentifier(value);
  return normalizeDownloadTransferId(id) ?? id;
}

function indexDownloadGroups(groups) {
  const indexedTransfers = new Map();
  const ambiguousIds = new Set();

  for (const group of Array.isArray(groups) ? groups : []) {
    const directories = Array.isArray(group?.directories) ? group.directories : [];
    for (const directory of directories) {
      const files = Array.isArray(directory?.files) ? directory.files : [];
      for (const transfer of files) {
        const transferId = normalizeTransferId(transfer?.id);
        if (!transferId || ambiguousIds.has(transferId)) {
          continue;
        }
        if (indexedTransfers.has(transferId)) {
          indexedTransfers.delete(transferId);
          ambiguousIds.add(transferId);
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
  getBoundDownloads = null,
} = {}) {
  async function buildTransferSnapshot({ requestedTransfers = [] } = {}) {
    const normalizedTransfers = Array.isArray(requestedTransfers)
      ? requestedTransfers.map((transfer) => ({
        ...transfer,
        id: normalizeTransferId(transfer?.id),
        username: normalizeTransferIdentifier(transfer?.username),
      })).filter((transfer) => transfer.id && transfer.username)
      : [];

    if (normalizedTransfers.length < 1) {
      return buildEmptySnapshot();
    }

    const key = (row) => `${row.providerBinding?.endpointFingerprint ?? ''}\u0000${row.username}\u0000${row.id}`;
    const exactRequested = typeof getBoundDownloads === 'function'
      ? normalizedTransfers.filter((row) => normalizeDownloadTransferId(row.id)) : [];
    const exactSnapshot = exactRequested.length ? await getBoundDownloads({ requestedTransfers: exactRequested }) : { observations: [] };
    const exactObservations = new Map((exactSnapshot.observations ?? []).map((row) => [key({ ...row.request, id: normalizeTransferId(row.request.id) }), row]));
    const usernames = [...new Set(normalizedTransfers.filter((row) => !exactRequested.includes(row)).map((transfer) => transfer.username))];
    const indexedTransfersByUsername = new Map(await Promise.all(usernames.map(async (username) => ([
      username,
      indexDownloadGroups(await getDownloads({
        includeRemoved: true,
        username,
      })),
    ]))));

    return {
      getTransfer({ id, username, providerBinding = null }) {
        const normalizedId = normalizeTransferId(id);
        const normalizedUsername = normalizeTransferIdentifier(username);
        if (!normalizedId || !normalizedUsername) {
          return null;
        }

        const exact = exactObservations.get(key({ id: normalizedId, username: normalizedUsername, providerBinding }));
        if (exact) return exact.transfer;
        if (providerBinding) return null;
        const matching = [...exactObservations.values()].filter((row) => normalizeTransferId(row.request.id) === normalizedId && row.request.username === normalizedUsername);
        if (matching.length === 1) return matching[0].transfer;
        if (matching.length > 1) return null;
        return indexedTransfersByUsername.get(normalizedUsername)?.get(normalizedId) ?? null;
      },
      isObservationPending({ id, username, providerBinding = null }) {
        const exact = exactObservations.get(key({ id: normalizeTransferId(id), username: normalizeTransferIdentifier(username), providerBinding }));
        if (exact) return Boolean(exact.issue);
        if (providerBinding) return true;
        const matching = [...exactObservations.values()].filter((row) => normalizeTransferId(row.request.id) === normalizeTransferId(id) && row.request.username === username);
        return matching.some((row) => row.issue) || matching.length > 1;
      },
      requestedTransferCount: normalizedTransfers.length,
      usernameCount: new Set(normalizedTransfers.map((row) => row.username)).size,
    };
  }

  return {
    buildTransferSnapshot,
  };
}
