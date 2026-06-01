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

function buildPersistedTransfer(transfer) {
  return {
    bytesTransferred: Number(transfer?.bytesTransferred) || 0,
    endedAt: transfer?.endedAt ?? null,
    exception: typeof transfer?.exception === 'string' && transfer.exception.trim()
      ? transfer.exception
      : null,
    filename: transfer?.filename ?? null,
    id: transfer?.id ?? null,
    placeInQueue: Number.isInteger(transfer?.placeInQueue) ? transfer.placeInQueue : null,
    size: Number(transfer?.size) || 0,
    startedAt: transfer?.startedAt ?? null,
    state: transfer?.state ?? null,
    username: transfer?.username ?? null,
  };
}

export function buildPersistedExecutionTransferSnapshot({
  liveTransferSummary,
  liveTransfers,
  reconciledAt = new Date().toISOString(),
} = {}) {
  const transfers = Array.isArray(liveTransfers)
    ? liveTransfers.map(buildPersistedTransfer).filter((transfer) => transfer.id && transfer.username)
    : [];

  if (!liveTransferSummary && transfers.length < 1) {
    return null;
  }

  return {
    lastReconciledAt: reconciledAt,
    lastSeenAt: reconciledAt,
    summary: liveTransferSummary ? {
      active: liveTransferSummary.active ?? 0,
      bytesTransferred: liveTransferSummary.bytesTransferred ?? 0,
      completed: liveTransferSummary.completed ?? 0,
      failed: liveTransferSummary.failed ?? 0,
      message: liveTransferSummary.message ?? null,
      missingTransfer: liveTransferSummary.missingTransfer ?? null,
      percentComplete: liveTransferSummary.percentComplete ?? null,
      queued: liveTransferSummary.queued ?? 0,
      rejected: liveTransferSummary.rejected ?? 0,
      status: liveTransferSummary.status ?? null,
      total: liveTransferSummary.total ?? transfers.length,
      totalBytes: liveTransferSummary.totalBytes ?? 0,
    } : null,
    transfers,
  };
}

export function buildPersistedExecutionMissingTransferState({
  checkedAt = new Date().toISOString(),
  liveTransferSummary,
  previousMissingTransfer = null,
} = {}) {
  const missingTransfer = liveTransferSummary?.missingTransfer;

  if (!missingTransfer) {
    return null;
  }

  return {
    graceDeadlineAt: missingTransfer.graceDeadlineAt ?? null,
    gracePeriodLabel: missingTransfer.gracePeriodLabel ?? null,
    gracePeriodMs: missingTransfer.gracePeriodMs ?? null,
    isPastGracePeriod: Boolean(missingTransfer.isPastGracePeriod),
    lastCheckedAt: checkedAt,
    message: liveTransferSummary?.message ?? null,
    missingSince: previousMissingTransfer?.missingSince ?? missingTransfer.missingSince ?? checkedAt,
    source: missingTransfer.source ?? null,
  };
}
