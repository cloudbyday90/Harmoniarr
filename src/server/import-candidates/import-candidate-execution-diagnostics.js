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

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeFilename(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTransferId(transfer) {
  return typeof transfer?.id === 'string' ? transfer.id.trim() : '';
}

export function buildNoUnlockedFilesDiagnostic({ candidate = null } = {}) {
  const totalFiles = normalizeCount(candidate?.fileCount);
  const lockedFiles = normalizeCount(candidate?.lockedFileCount);

  return {
    code: 'no_unlocked_files',
    counts: {
      lockedFiles,
      requestedFiles: 0,
      totalFiles,
    },
    message: 'No unlocked files are available to enqueue from this candidate.',
    operatorAction: 'Open the candidate, review locked or filtered files, then select a candidate with downloadable files.',
    title: 'No downloadable files',
    tone: 'warning',
  };
}

export function buildPlanningBlockedDiagnostic({ candidate = null, message = '' } = {}) {
  return {
    code: 'planning_blocked',
    counts: {
      requestedFiles: 0,
      totalFiles: normalizeCount(candidate?.fileCount),
    },
    message: message || 'This candidate is blocked before provider enqueue.',
    operatorAction: 'Review the candidate planning details, especially path mappings and validation blockers.',
    title: 'Download planning blocked',
    tone: 'warning',
  };
}

export function buildDownloadAcceptanceDiagnostic({
  enqueueResult = {},
  requestedFiles = [],
  warningMessage = null,
} = {}) {
  const enqueuedTransfers = Array.isArray(enqueueResult.enqueued)
    ? enqueueResult.enqueued
    : [];
  const failedFilenames = Array.isArray(enqueueResult.failed)
    ? enqueueResult.failed.map(normalizeFilename).filter(Boolean)
    : [];
  const requestedCount = requestedFiles.length;
  const enqueuedCount = enqueuedTransfers.length;
  const failedCount = failedFilenames.length;
  const enqueuedTransferIds = enqueuedTransfers.map(normalizeTransferId).filter(Boolean);

  if (requestedCount > 0 && failedCount > 0 && enqueuedCount === 0) {
    return {
      code: 'provider_rejected_all_files',
      counts: {
        enqueuedTransfers: enqueuedCount,
        failedFiles: failedCount,
        requestedFiles: requestedCount,
      },
      failedFilenames,
      message: `The download provider rejected all ${pluralize(requestedCount, 'file')} for this candidate.`,
      operatorAction: 'Try another candidate or rerun discovery; the remote peer may no longer offer acceptable files.',
      title: 'Provider rejected the candidate',
      tone: 'danger',
    };
  }

  if (failedCount > 0) {
    return {
      code: 'provider_accepted_with_rejections',
      counts: {
        enqueuedTransfers: enqueuedCount,
        failedFiles: failedCount,
        requestedFiles: requestedCount,
      },
      enqueuedTransferIds,
      failedFilenames,
      message: `The download provider accepted ${pluralize(enqueuedCount, 'transfer')} and rejected ${pluralize(failedCount, 'file')}.`,
      operatorAction: 'Monitor the accepted transfer and review rejected files before applying the download.',
      title: 'Provider accepted with warnings',
      tone: 'warning',
    };
  }

  return {
    code: 'provider_accepted',
    counts: {
      enqueuedTransfers: enqueuedCount,
      failedFiles: 0,
      requestedFiles: requestedCount,
    },
    enqueuedTransferIds,
    message: `The download provider accepted ${pluralize(enqueuedCount, 'transfer')} for this candidate.`,
    operatorAction: warningMessage
      ? 'Monitor the transfer and resolve the warning before import apply.'
      : 'Monitor Downloader until the transfer completes, then continue import review.',
    title: warningMessage ? 'Provider accepted with candidate warning' : 'Provider accepted transfer',
    tone: warningMessage ? 'warning' : 'success',
    warningMessage: warningMessage || null,
  };
}
