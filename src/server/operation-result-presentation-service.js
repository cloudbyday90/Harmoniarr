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

export function formatFileOperationStatusLabel(status) {
  switch (status) {
    case 'applied':
    case 'moved':
      return 'Applied';
    case 'failed':
      return 'Failed';
    case 'not_attempted':
      return 'Not attempted';
    case 'pending':
      return 'Pending';
    case 'skipped':
      return 'Skipped';
    default:
      return status ?? '';
  }
}

export function formatFileOperationStatusTone(status) {
  switch (status) {
    case 'applied':
    case 'moved':
      return 'success';
    case 'failed':
      return 'danger';
    case 'not_attempted':
      return 'muted';
    case 'pending':
      return 'info';
    case 'skipped':
      return 'muted';
    default:
      return 'muted';
  }
}

export function formatOperationOutcomeLabel(outcome) {
  switch (outcome) {
    case 'completed':
      return 'All items processed successfully';
    case 'empty':
      return 'No items to process';
    case 'failed':
      return 'All items failed';
    case 'partial':
      return 'Some items failed';
    default:
      return outcome ?? '';
  }
}

export function formatOperationOutcomeTone(outcome) {
  switch (outcome) {
    case 'completed':
      return 'success';
    case 'empty':
      return 'muted';
    case 'failed':
      return 'danger';
    case 'partial':
      return 'warning';
    default:
      return 'muted';
  }
}

export function formatResultBreakdownSummary(breakdown) {
  if (!breakdown || breakdown.totalItems === 0) {
    return 'No items to process.';
  }

  const { failedCount, notAttemptedCount, skippedCount, succeededCount, totalItems } = breakdown;
  const parts = [];

  parts.push(`${succeededCount} of ${totalItems} succeeded`);

  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  if (skippedCount > 0) {
    parts.push(`${skippedCount} skipped`);
  }

  if (notAttemptedCount > 0) {
    parts.push(`${notAttemptedCount} not attempted`);
  }

  return `${parts.join(', ')}.`;
}

export function buildOrganizeResultSummaryMessage(summary) {
  if (!summary) {
    return 'No organize run recorded.';
  }

  const { failedCount = 0, movedCount = 0, notAttemptedCount = 0, outcome = 'empty', plannedRenameCount = 0, skippedCount = 0 } = summary;

  if (outcome === 'partial') {
    return `Organized ${movedCount} of ${plannedRenameCount} files. ${failedCount} failed, ${notAttemptedCount} not attempted.`;
  }

  if (outcome === 'failed') {
    if (plannedRenameCount === 0) {
      return 'Library organize found no files to rename.';
    }

    return `All ${plannedRenameCount} organize renames failed.`;
  }

  if (outcome === 'completed') {
    return `Successfully organized ${movedCount} file${movedCount === 1 ? '' : 's'}. ${skippedCount} skipped.`;
  }

  return 'No files to organize.';
}

export function buildScanResultSummaryMessage(summary) {
  if (!summary) {
    return 'No scan run recorded.';
  }

  const { filesMatched = 0, filesSeen = 0, filesUnmatched = 0, libraryRoot = null } = summary;
  const rootLabel = libraryRoot ? ` in ${libraryRoot}` : '';

  if (filesSeen === 0) {
    return `No files found${rootLabel}.`;
  }

  return `Found ${filesSeen} file${filesSeen === 1 ? '' : 's'}${rootLabel}: ${filesMatched} audio, ${filesUnmatched} other.`;
}

export function buildDiscoveryResultSummaryMessage(summary) {
  if (!summary) {
    return 'No discovery run recorded.';
  }

  const { attemptedCount = 0, candidateCount = 0, dispatchedCount = 0, failedCount = 0 } = summary;

  if (attemptedCount === 0) {
    return 'No discovery requests to dispatch.';
  }

  if (failedCount > 0) {
    return `Dispatched ${dispatchedCount} of ${attemptedCount} searches (${failedCount} failed). Found ${candidateCount} candidates.`;
  }

  return `Dispatched ${dispatchedCount} search${dispatchedCount === 1 ? '' : 'es'}. Found ${candidateCount} candidates.`;
}
