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