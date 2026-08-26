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

import { formatOperationTimestampShort } from './operation-run-presentation.js';

function normalizeReconciliationStatus(reconciliation = {}) {
  return typeof reconciliation?.status === 'string'
    ? reconciliation.status.toLowerCase()
    : '';
}

function getLatestReleasePlanTimestamp(reconciliation = {}) {
  const snapshot = reconciliation?.latestSnapshot;
  return snapshot?.updatedAt ?? snapshot?.createdAt ?? null;
}

/**
 * Formats the release-plan activity shown in Artist Detail. Unlike the compact
 * Home card, this deeper view can retain a completion timestamp for context.
 *
 * @param {{ latestSnapshot?: { createdAt?: string, updatedAt?: string }, status?: string }|null|undefined} reconciliation
 * @param {{ nowFn?: () => number }} [options]
 * @returns {string}
 */
export function formatOperatorArtistReleasePlanActivity(reconciliation = {}, options = {}) {
  switch (normalizeReconciliationStatus(reconciliation)) {
    case 'running':
      return 'Release plan update is running.';
    case 'queued':
    case 'pending':
      return 'Release plan update is queued.';
    case 'completed': {
      const timestamp = getLatestReleasePlanTimestamp(reconciliation);
      if (!timestamp) {
        return 'Release plan updated.';
      }

      return `Release plan updated ${formatOperationTimestampShort(timestamp, options)}.`;
    }
    case 'failed':
      return 'Release plan update needs attention.';
    case 'cancelled':
      return 'Release plan update stopped.';
    default:
      return 'Release plan has not been updated yet.';
  }
}
