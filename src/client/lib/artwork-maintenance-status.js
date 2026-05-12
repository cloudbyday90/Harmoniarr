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
  getOperationRunStatusClass,
  getOperationRunStatusLabel,
} from './operation-run-status.js';

export function getArtworkMaintenanceStatusLabel(status) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'waiting':
      return 'Waiting';
    case 'running':
      return 'Running';
    case 'pending':
      return 'Queued';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Empty';
  }
}

export function getArtworkMaintenanceStatusClass(status) {
  switch (status) {
    case 'ready':
    case 'completed':
      return 'review-status-selected';
    case 'running':
    case 'pending':
      return 'review-status-pending';
    case 'failed':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

export function getArtworkCleanupRunStatusLabel(status) {
  return getOperationRunStatusLabel(status);
}

export function getArtworkCleanupRunStatusClass(status) {
  return getOperationRunStatusClass(status);
}

export function canStartArtworkCleanup(summaryPayload) {
  if (!summaryPayload) {
    return false;
  }

  if ((summaryPayload.inventory?.eligibleAssetCount ?? 0) < 1) {
    return false;
  }

  return !['pending', 'running'].includes(summaryPayload.latestRun?.status);
}

export function getArtworkCleanupHistorySummary(run) {
  if (run.status === 'failed') {
    return run.errorMessage || `${run.failedAssetCount ?? 0} artwork asset cleanup failure${run.failedAssetCount === 1 ? '' : 's'} need review.`;
  }

  if (run.status === 'completed') {
    return `Deleted ${run.deletedAssetCount ?? 0} asset${run.deletedAssetCount === 1 ? '' : 's'} and skipped ${run.missingFileCount ?? 0} missing file${run.missingFileCount === 1 ? '' : 's'}.`;
  }

  if (run.status === 'running' || run.status === 'pending') {
    return `Requested ${run.requestedAssetCount ?? 0} retention-eligible asset${run.requestedAssetCount === 1 ? '' : 's'} for cleanup.`;
  }

  return 'No details were recorded for this cleanup run.';
}

export function getArtworkCleanupDetailTitle(run) {
  if (run.status === 'failed') {
    return 'Selected cleanup run failed';
  }

  if (run.status === 'completed') {
    return 'Selected cleanup run completed';
  }

  if (run.status === 'running') {
    return 'Selected cleanup run is active';
  }

  if (run.status === 'pending') {
    return 'Selected cleanup run is queued';
  }

  return 'Selected cleanup run';
}