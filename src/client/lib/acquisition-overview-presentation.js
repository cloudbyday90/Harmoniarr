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

import { formatTransferFilename } from './activity-downloads-presentation.js';
import { getDownloaderMusicQueueRelease } from './downloader-music-queue-link.js';
import { buildDownloaderTransferLocation } from './downloader-transfer-route.js';
import { isDownloaderProviderDisabled } from './downloader-presentation.js';
import { buildReleaseScopedDownloaderHandoff } from './music-queue-downloader-handoff.js';
import {
  isMusicQueueActiveProgressRelease,
  isMusicQueueAttentionRelease,
} from './music-queue-progress-state.js';
import { formatBytes, formatSpeed } from './search-presentation.js';

export const ACQUISITION_OVERVIEW_TRANSFER_LIMIT = 5;

function getCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function getTransferPriority(transfer) {
  if (transfer?.state?.code === 'active') return 0;
  if (transfer?.state?.code === 'queued') return 1;
  return 2;
}

function getTransferProgressLabel(transfer) {
  const value = transfer?.progress?.percentComplete;
  if (Number.isFinite(value)) return `${Math.round(value)}%`;
  return transfer?.state?.code === 'queued' ? 'Queued' : 'Waiting for progress';
}

function buildTransferDetail(transfer) {
  const detailParts = [
    transfer?.sourceUser ? `From ${transfer.sourceUser}` : null,
    Number.isFinite(transfer?.progress?.size) ? formatBytes(transfer.progress.size) : null,
    Number.isFinite(transfer?.averageSpeed) && transfer.averageSpeed > 0
      ? formatSpeed(transfer.averageSpeed)
      : null,
  ].filter(Boolean);

  return detailParts.length > 0
    ? detailParts.join(' · ')
    : 'The download client has not reported more detail yet.';
}

function buildTransferAction(transfer, title) {
  const linkedRelease = getDownloaderMusicQueueRelease(transfer);
  const handoff = linkedRelease
    ? buildReleaseScopedDownloaderHandoff({
      artistName: linkedRelease.artistName,
      id: linkedRelease.wantedReleaseId,
      releaseTitle: linkedRelease.releaseTitle,
    })
    : null;

  if (handoff) {
    return handoff;
  }

  const location = buildDownloaderTransferLocation(transfer);
  return location
    ? {
      accessibleLabel: `Open ${title} in Downloader`,
      label: 'Open',
      location,
    }
    : null;
}

/**
 * Creates the compact, read-only summary for the Acquisition overview. It
 * deliberately preserves separate release and transfer lanes. It only shows
 * a cross-lane relation when the queue supplies a durable wanted-release ID.
 *
 * @param {{ canViewDownloader?: boolean, downloaderQueue?: object | null, releases?: object[] }} options
 * @returns {Array<{ key: string, label: string, meta: string, tone: string, value: number }>}
 */
export function buildAcquisitionOverviewCards({
  canViewDownloader = false,
  downloaderQueue = null,
  releases = [],
} = {}) {
  const normalizedReleases = Array.isArray(releases) ? releases : [];
  const cards = [
    {
      key: 'release-actions',
      label: 'Available actions',
      meta: 'Open a release to see its next step.',
      tone: normalizedReleases.some(isMusicQueueAttentionRelease) ? 'warning' : 'info',
      value: normalizedReleases.filter(isMusicQueueAttentionRelease).length,
    },
    {
      key: 'release-progress',
      label: 'Moving automatically',
      meta: 'Harmoniarr continues eligible release work.',
      tone: normalizedReleases.some(isMusicQueueActiveProgressRelease) ? 'info' : 'success',
      value: normalizedReleases.filter(isMusicQueueActiveProgressRelease).length,
    },
  ];

  if (!canViewDownloader) return cards;

  const counts = downloaderQueue?.queueHealth?.counts ?? {};
  cards.push(
    {
      key: 'active-transfers',
      label: 'Active transfers',
      meta: 'Live progress from Downloader.',
      tone: getCount(counts.active) > 0 ? 'warning' : 'info',
      value: getCount(counts.active),
    },
    {
      key: 'queued-transfers',
      label: 'Queued transfers',
      meta: 'Waiting for Downloader to continue.',
      tone: getCount(counts.queued) > 0 ? 'warning' : 'info',
      value: getCount(counts.queued),
    },
  );

  return cards;
}

/**
 * Returns a bounded ordered set of live transfer rows. Completed and failed
 * transfers stay in Downloader, where their diagnostics and recovery controls
 * remain available.
 *
 * @param {object | null | undefined} downloaderQueue
 * @param {{ limit?: number }} options
 * @returns {Array<{ action: object | null, detail: string, id: string, location: object | null, progressLabel: string, progressValue: number | null, statusLabel: string, statusTone: string, title: string }>}
 */
export function buildAcquisitionTransferRows(downloaderQueue, { limit = ACQUISITION_OVERVIEW_TRANSFER_LIMIT } = {}) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || ACQUISITION_OVERVIEW_TRANSFER_LIMIT, 10));
  const transfers = Array.isArray(downloaderQueue?.transfers) ? downloaderQueue.transfers : [];

  return transfers
    .filter((transfer) => ['active', 'queued'].includes(transfer?.state?.code))
    .sort((left, right) => {
      const priorityDifference = getTransferPriority(left) - getTransferPriority(right);
      if (priorityDifference !== 0) return priorityDifference;

      return String(left?.filename ?? '').localeCompare(String(right?.filename ?? ''));
    })
    .slice(0, normalizedLimit)
    .map((transfer, index) => {
      const title = formatTransferFilename(transfer?.filename);
      const action = buildTransferAction(transfer, title);

      return {
        action,
        detail: buildTransferDetail(transfer),
        id: transfer?.transferKey ?? `${transfer?.sourceUser ?? 'unknown'}-${transfer?.id ?? index}`,
        location: action?.location ?? null,
        progressLabel: getTransferProgressLabel(transfer),
        progressValue: Number.isFinite(transfer?.progress?.percentComplete)
          ? Math.max(0, Math.min(100, Math.round(transfer.progress.percentComplete)))
          : null,
        statusLabel: transfer?.state?.label ?? 'In progress',
        statusTone: transfer?.state?.tone ?? 'info',
        title,
      };
    });
}

/**
 * Produces the static transfer-panel state while the view owns asynchronous
 * loading and error feedback. This protects callers from interpreting a
 * missing provider payload as an empty transfer queue.
 *
 * @param {object | null | undefined} downloaderQueue
 * @param {{ canViewDownloader?: boolean }} options
 * @returns {{ body: string, state: 'available' | 'empty' | 'restricted' | 'setup', rows: ReturnType<typeof buildAcquisitionTransferRows>, title: string }}
 */
export function buildAcquisitionTransferPanel(downloaderQueue, { canViewDownloader = false } = {}) {
  if (!canViewDownloader) {
    return {
      body: 'Download progress is available to administrators.',
      rows: [],
      state: 'restricted',
      title: 'Download progress',
    };
  }

  if (isDownloaderProviderDisabled(downloaderQueue)) {
    return {
      body: downloaderQueue?.providerState?.message
        ?? 'Set up Soulseek before Harmoniarr can show download progress.',
      rows: [],
      state: 'setup',
      title: 'Set up Soulseek',
    };
  }

  const rows = buildAcquisitionTransferRows(downloaderQueue);
  if (rows.length < 1) {
    return {
      body: 'No transfers are active or queued right now.',
      rows,
      state: 'empty',
      title: 'Download progress',
    };
  }

  return {
    body: `${rows.length} live transfer${rows.length === 1 ? '' : 's'} shown. Open Downloader for the full queue.`,
    rows,
    state: 'available',
    title: 'Download progress',
  };
}
