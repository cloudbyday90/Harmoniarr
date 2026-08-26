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
import { buildReleaseScopedDownloaderHandoff } from './music-queue-downloader-handoff.js';

const LIVE_TRANSFER_STATES = new Set(['active', 'queued']);

function addCountPhrase(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildProgressSummary({ activeCount, queuedCount }) {
  const phrases = [];

  if (activeCount > 0) {
    phrases.push(addCountPhrase(activeCount, 'transfer is downloading', 'transfers are downloading'));
  }

  if (queuedCount > 0) {
    phrases.push(addCountPhrase(queuedCount, 'transfer is waiting', 'transfers are waiting'));
  }

  return phrases.join('; ');
}

function createReleaseProgress(release) {
  return {
    activeCount: 0,
    artistName: release.artistName,
    queuedCount: 0,
    releaseTitle: release.releaseTitle,
    wantedReleaseId: release.wantedReleaseId,
  };
}

/**
 * Derives a small, read-only transfer summary for each Music Queue release on
 * the Acquisition overview. The only join key is the server-projected
 * `wantedReleaseId`; filenames, provider usernames, paths, and transfer IDs
 * are deliberately not used as correlation signals or exposed in this map.
 *
 * @param {object | null | undefined} downloaderQueue
 * @returns {Record<string, { activeCount: number, handoff: object, queuedCount: number, summary: string, transferCount: number, wantedReleaseId: string }>}
 */
export function buildAcquisitionReleaseTransferProgress(downloaderQueue) {
  const transfers = Array.isArray(downloaderQueue?.transfers) ? downloaderQueue.transfers : [];
  const releaseProgress = new Map();

  for (const transfer of transfers) {
    const stateCode = transfer?.state?.code;
    if (!LIVE_TRANSFER_STATES.has(stateCode)) continue;

    const release = getDownloaderMusicQueueRelease(transfer);
    if (!release) continue;

    const existing = releaseProgress.get(release.wantedReleaseId)
      ?? createReleaseProgress(release);
    if (stateCode === 'active') {
      existing.activeCount += 1;
    } else {
      existing.queuedCount += 1;
    }
    releaseProgress.set(release.wantedReleaseId, existing);
  }

  return Object.fromEntries(
    [...releaseProgress.entries()].flatMap(([wantedReleaseId, progress]) => {
      const handoff = buildReleaseScopedDownloaderHandoff(progress);
      if (!handoff) return [];

      return [[wantedReleaseId, {
        activeCount: progress.activeCount,
        handoff,
        queuedCount: progress.queuedCount,
        summary: buildProgressSummary(progress),
        transferCount: progress.activeCount + progress.queuedCount,
        wantedReleaseId,
      }]];
    }),
  );
}
