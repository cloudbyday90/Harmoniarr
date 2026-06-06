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
  buildDownloaderActionEligibility,
  buildDownloaderTransferDiagnostics,
  calculateDownloaderTransferProgress,
  classifyDownloaderTransferState,
} from './downloader-transfer-policy.js';

const defaultMaxTransferRows = 1000;

function normalizeBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeObservedAt(now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function flattenDownloadGroups(groups) {
  if (!Array.isArray(groups)) return [];

  const transfers = [];
  for (const group of groups) {
    const sourceUser = normalizeString(group?.username);
    const directories = Array.isArray(group?.directories) ? group.directories : [];
    for (const directory of directories) {
      const directoryName = normalizeString(directory?.directory);
      const files = Array.isArray(directory?.files) ? directory.files : [];
      for (const file of files) {
        if (!file || typeof file !== 'object') continue;
        transfers.push({
          ...file,
          directory: normalizeString(file.directory) ?? directoryName,
          username: normalizeString(file.username) ?? sourceUser,
        });
      }
    }
  }

  return transfers;
}

function normalizeTransfer(transfer, index) {
  const state = classifyDownloaderTransferState(transfer);
  const progress = calculateDownloaderTransferProgress(transfer);
  const timestamps = {
    endedAt: normalizeTimestamp(transfer?.endedAt),
    enqueuedAt: normalizeTimestamp(transfer?.enqueuedAt),
    requestedAt: normalizeTimestamp(transfer?.requestedAt),
    startedAt: normalizeTimestamp(transfer?.startedAt),
  };

  return {
    actionEligibility: buildDownloaderActionEligibility(),
    averageSpeed: normalizeNumber(transfer?.averageSpeed),
    diagnostics: buildDownloaderTransferDiagnostics(transfer, {
      progress,
      state,
      timestamps,
    }),
    directory: normalizeString(transfer?.directory),
    filename: normalizeString(transfer?.filename),
    id: normalizeString(transfer?.id),
    placeInQueue: normalizeNumber(transfer?.placeInQueue),
    progress,
    sourceUser: normalizeString(transfer?.username),
    state,
    timestamps,
    transferKey: [
      normalizeString(transfer?.username) ?? 'unknown-source',
      normalizeString(transfer?.id) ?? `row-${index + 1}`,
    ].join('::'),
  };
}

function createEmptyCounts() {
  return {
    active: 0,
    completed: 0,
    failed: 0,
    other: 0,
    queued: 0,
    total: 0,
  };
}

function buildCounts(transfers) {
  const counts = createEmptyCounts();
  counts.total = transfers.length;

  for (const transfer of transfers) {
    if (Object.hasOwn(counts, transfer.state.code)) {
      counts[transfer.state.code] += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

function buildAggregateProgress(transfers) {
  const progressRows = transfers
    .map((transfer) => transfer.progress)
    .filter((progress) => Number.isFinite(progress?.size) && Number.isFinite(progress?.bytesTransferred));

  const size = progressRows.reduce((sum, progress) => sum + progress.size, 0);
  const bytesTransferred = progressRows.reduce((sum, progress) => sum + progress.bytesTransferred, 0);

  return {
    bytesTransferred: size > 0 ? bytesTransferred : null,
    percentComplete: size > 0 ? Math.min(100, Math.round((bytesTransferred / size) * 100)) : null,
    size: size > 0 ? size : null,
  };
}

function buildQueueHealthMessage(counts) {
  if (counts.failed > 0) {
    return `${counts.failed} transfer${counts.failed === 1 ? ' needs' : 's need'} attention.`;
  }

  if (counts.active > 0 || counts.queued > 0) {
    const active = `${counts.active} active`;
    const queued = `${counts.queued} queued`;
    return `${active} and ${queued} transfer${counts.active + counts.queued === 1 ? '' : 's'} are in the queue.`;
  }

  if (counts.completed > 0) {
    return `${counts.completed} completed transfer${counts.completed === 1 ? '' : 's'} are visible.`;
  }

  if (counts.total === 0) {
    return 'No transfers are currently visible.';
  }

  return `${counts.total} transfer${counts.total === 1 ? '' : 's'} have an unrecognized state.`;
}

function buildQueueHealth(counts, transfers) {
  const status = counts.failed > 0
    ? 'attention'
    : counts.active > 0 || counts.queued > 0
      ? 'busy'
      : counts.total === 0
        ? 'idle'
        : counts.other > 0
          ? 'unknown'
          : 'healthy';

  const averageSpeed = transfers.reduce((sum, transfer) => sum + (transfer.averageSpeed ?? 0), 0);

  return {
    averageSpeed,
    counts,
    message: buildQueueHealthMessage(counts),
    progress: buildAggregateProgress(transfers),
    status,
  };
}

function buildSourceGroups(transfers) {
  const groups = new Map();

  for (const transfer of transfers) {
    const sourceUser = transfer.sourceUser ?? 'Unknown source';
    const current = groups.get(sourceUser) ?? {
      counts: createEmptyCounts(),
      sourceUser,
    };
    current.counts.total += 1;
    if (Object.hasOwn(current.counts, transfer.state.code)) {
      current.counts[transfer.state.code] += 1;
    } else {
      current.counts.other += 1;
    }
    groups.set(sourceUser, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => a.sourceUser.localeCompare(b.sourceUser));
}

function normalizeMaxTransferRows(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultMaxTransferRows;
}

export function buildDownloaderQueueReadModelFromDownloads(downloadGroups, {
  includeRemoved = false,
  maxTransferRows = defaultMaxTransferRows,
  now = () => new Date(),
} = {}) {
  const observedAt = normalizeObservedAt(now);
  const allTransfers = flattenDownloadGroups(downloadGroups);
  const normalizedMaxTransferRows = normalizeMaxTransferRows(maxTransferRows);
  const transfers = allTransfers
    .slice(0, normalizedMaxTransferRows)
    .map((transfer, index) => normalizeTransfer(transfer, index));
  const counts = buildCounts(transfers);

  return {
    includeRemoved: normalizeBoolean(includeRemoved, false),
    observedAt,
    provider: 'slskd',
    queueHealth: buildQueueHealth(counts, transfers),
    sourceGroups: buildSourceGroups(transfers),
    transfers,
    truncated: allTransfers.length > transfers.length,
  };
}

export function createDownloaderQueueReadModelService({
  getDownloads,
  maxTransferRows = defaultMaxTransferRows,
  now = () => new Date(),
} = {}) {
  if (typeof getDownloads !== 'function') {
    throw new TypeError('createDownloaderQueueReadModelService requires getDownloads');
  }

  async function buildDownloaderQueue({ includeRemoved = false } = {}) {
    const normalizedIncludeRemoved = normalizeBoolean(includeRemoved, false);
    const downloads = await getDownloads({ includeRemoved: normalizedIncludeRemoved });

    return buildDownloaderQueueReadModelFromDownloads(downloads, {
      includeRemoved: normalizedIncludeRemoved,
      maxTransferRows,
      now,
    });
  }

  return {
    buildDownloaderQueue,
  };
}
