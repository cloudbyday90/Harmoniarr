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

import { getDownloaderMusicQueueRelease } from './downloader-music-queue-link.js';

export const DOWNLOADER_TRANSFER_STATE_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ label: 'All states', value: 'all' }),
  Object.freeze({ label: 'Active', value: 'active' }),
  Object.freeze({ label: 'Queued', value: 'queued' }),
  Object.freeze({ label: 'Completed', value: 'completed' }),
  Object.freeze({ label: 'Failed', value: 'failed' }),
]);

const supportedStateFilters = new Set(
  DOWNLOADER_TRANSFER_STATE_FILTER_OPTIONS.map((option) => option.value),
);

function normalizeStateFilter(value) {
  return supportedStateFilters.has(value) ? value : 'all';
}

function matchesStateFilter(transfer, stateFilter) {
  return stateFilter === 'all' || transfer?.state?.code === stateFilter;
}

function normalizeWantedReleaseId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function matchesMusicQueueRelease(transfer, wantedReleaseId) {
  return !wantedReleaseId
    || getDownloaderMusicQueueRelease(transfer)?.wantedReleaseId === wantedReleaseId;
}

export function isDownloaderTransferLinkedToMusicQueue(transfer) {
  return Boolean(getDownloaderMusicQueueRelease(transfer));
}

export function filterDownloaderTransfers(transfers, {
  musicQueueLinkedOnly = false,
  stateFilter = 'all',
  wantedReleaseId = '',
} = {}) {
  if (!Array.isArray(transfers)) {
    return [];
  }

  const normalizedStateFilter = normalizeStateFilter(stateFilter);
  const normalizedWantedReleaseId = normalizeWantedReleaseId(wantedReleaseId);

  return transfers.filter((transfer) => (
    matchesStateFilter(transfer, normalizedStateFilter)
    && (!musicQueueLinkedOnly || isDownloaderTransferLinkedToMusicQueue(transfer))
    && matchesMusicQueueRelease(transfer, normalizedWantedReleaseId)
  ));
}

export function buildDownloaderTransferFilterResultLabel(visibleCount, totalCount, {
  releaseContextLabel = 'Music Queue release',
  wantedReleaseId = '',
} = {}) {
  const normalizedVisibleCount = Number.isFinite(visibleCount) ? Math.max(0, visibleCount) : 0;
  const normalizedTotalCount = Number.isFinite(totalCount) ? Math.max(0, totalCount) : 0;
  const transferLabel = normalizedTotalCount === 1 ? 'transfer' : 'transfers';

  if (normalizeWantedReleaseId(wantedReleaseId)) {
    const normalizedReleaseContextLabel = typeof releaseContextLabel === 'string' && releaseContextLabel.trim()
      ? releaseContextLabel.trim()
      : 'release';
    return `Showing ${normalizedVisibleCount} ${normalizedVisibleCount === 1 ? 'transfer' : 'transfers'} linked to this ${normalizedReleaseContextLabel}.`;
  }

  return `Showing ${normalizedVisibleCount} of ${normalizedTotalCount} ${transferLabel}.`;
}
