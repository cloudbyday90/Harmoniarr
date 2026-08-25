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

function normalizeDownloaderPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const downloader = payload.downloader;
  return downloader && typeof downloader === 'object' && !Array.isArray(downloader)
    ? downloader
    : payload;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getMusicQueueRelease(transfer) {
  const release = transfer?.diagnostics?.importLinkage?.musicQueueRelease;
  const wantedReleaseId = normalizeString(release?.wantedReleaseId);
  return wantedReleaseId ? { wantedReleaseId } : null;
}

function getTransferIdentity(transfer) {
  const transferKey = normalizeString(transfer?.transferKey);
  if (transferKey) return transferKey;

  const sourceUser = normalizeString(transfer?.sourceUser);
  const id = normalizeString(transfer?.id);
  return sourceUser && id ? `${sourceUser}::${id}` : null;
}

function getTransfers(payload) {
  const transfers = normalizeDownloaderPayload(payload).transfers;
  return Array.isArray(transfers) ? transfers : [];
}

/**
 * Returns bounded operator evidence only. Transfer identities are kept out of
 * persisted evidence and are used solely to compare the two in-memory polls.
 */
export function summarizeMusicQueueTransferLinkage(downloaderQueue) {
  const transfers = getTransfers(downloaderQueue);
  const linkedTransferIdentities = new Set();

  for (const transfer of transfers) {
    if (!getMusicQueueRelease(transfer)) continue;
    const identity = getTransferIdentity(transfer);
    if (identity) linkedTransferIdentities.add(identity);
  }

  return {
    linkedTransferCount: linkedTransferIdentities.size,
    totalTransferCount: transfers.length,
  };
}

export function assertMusicQueueTransferLinkagePreserved({
  beforeRefresh,
  afterRefresh,
} = {}) {
  const beforeTransfers = getTransfers(beforeRefresh);
  const afterLinkedIdentities = new Set(
    getTransfers(afterRefresh)
      .filter((transfer) => getMusicQueueRelease(transfer))
      .map(getTransferIdentity)
      .filter(Boolean),
  );
  const beforeLinkedIdentities = beforeTransfers
    .filter((transfer) => getMusicQueueRelease(transfer))
    .map(getTransferIdentity)
    .filter(Boolean);

  if (beforeLinkedIdentities.length < 1) {
    throw new Error('Expected at least one Downloader transfer linked to Music Queue');
  }

  const missingLinkCount = beforeLinkedIdentities.filter((identity) => !afterLinkedIdentities.has(identity)).length;
  if (missingLinkCount > 0) {
    throw new Error(`Expected Music Queue transfer linkage to survive refresh; ${missingLinkCount} linked transfer${missingLinkCount === 1 ? '' : 's'} disappeared`);
  }

  return {
    afterRefresh: summarizeMusicQueueTransferLinkage(afterRefresh),
    beforeRefresh: summarizeMusicQueueTransferLinkage(beforeRefresh),
  };
}
