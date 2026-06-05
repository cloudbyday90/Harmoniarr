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

const exposedTransferStatuses = new Set([
  'active',
  'completed',
  'failed',
  'queued',
  'rejected',
]);

function normalizeObservedAt(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizePercentComplete(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function buildMediaRequestTransferProgress(planningSnapshot) {
  const transferSnapshot = planningSnapshot?.execution?.latestTransferSnapshot;
  const summary = transferSnapshot?.summary;

  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const status = exposedTransferStatuses.has(summary.status)
    ? summary.status
    : null;
  const percentComplete = normalizePercentComplete(summary.percentComplete);
  const observedAt = normalizeObservedAt(transferSnapshot.lastReconciledAt);

  if (!status && percentComplete == null && !observedAt) {
    return null;
  }

  return {
    observedAt,
    percentComplete,
    status,
  };
}
