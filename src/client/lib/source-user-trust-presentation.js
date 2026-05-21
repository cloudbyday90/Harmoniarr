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

import { formatOperationTimestamp } from './operation-run-presentation.js';

export const sourceUserTrustFilters = Object.freeze([
  Object.freeze({ value: 'all', label: 'All' }),
  Object.freeze({ value: 'watch', label: 'Needs review' }),
  Object.freeze({ value: 'blocked', label: 'Blocked' }),
  Object.freeze({ value: 'trusted', label: 'Trusted' }),
  Object.freeze({ value: 'unknown', label: 'Unknown' }),
]);

export const sourceUserTrustStateOptions = Object.freeze([
  Object.freeze({ value: 'trusted', label: 'Mark trusted' }),
  Object.freeze({ value: 'neutral', label: 'Set neutral' }),
]);

export function formatSourceUserCountLabel(count) {
  if (!Number.isFinite(count) || count < 1) {
    return 'No source users';
  }

  return `${count} source user${count === 1 ? '' : 's'}`;
}

export function formatSourceUsername(username) {
  return typeof username === 'string' && username.trim() ? username : 'Unknown peer';
}

export function formatSourceUserTrustLabel(trustState) {
  switch (trustState) {
    case 'blocked':
      return 'Blocked';
    case 'trusted':
      return 'Trusted';
    default:
      return 'Neutral';
  }
}

export function formatSourceUserTrustTone(trustState) {
  switch (trustState) {
    case 'blocked':
      return 'danger';
    case 'trusted':
      return 'success';
    default:
      return 'info';
  }
}

export function formatSourceUserReviewLabel(reviewState) {
  switch (reviewState) {
    case 'excluded':
      return 'Excluded';
    case 'healthy':
      return 'Healthy';
    case 'normal':
      return 'Normal';
    case 'preferred':
      return 'Preferred';
    case 'unknown':
      return 'Unknown';
    case 'watch':
      return 'Needs review';
    default:
      return 'Unknown';
  }
}

export function formatSourceUserReviewTone(reviewState) {
  switch (reviewState) {
    case 'excluded':
      return 'danger';
    case 'healthy':
    case 'preferred':
      return 'success';
    case 'watch':
      return 'warning';
    case 'normal':
      return 'info';
    default:
      return 'muted';
  }
}

export function formatSourceUserReliabilityLabel(reliability) {
  switch (reliability) {
    case 'strong':
      return 'Strong';
    case 'good':
      return 'Good';
    case 'mixed':
      return 'Mixed';
    case 'poor':
      return 'Poor';
    default:
      return 'Unknown';
  }
}

export function formatSourceUserReliabilityTone(reliability) {
  switch (reliability) {
    case 'strong':
    case 'good':
      return 'success';
    case 'mixed':
      return 'warning';
    case 'poor':
      return 'danger';
    default:
      return 'muted';
  }
}

export function formatSourceUserEvidence(reputation) {
  const successCount = Number.isFinite(reputation?.successCount) ? reputation.successCount : 0;
  const failureCount = Number.isFinite(reputation?.failureCount) ? reputation.failureCount : 0;
  const evidenceCount = Number.isFinite(reputation?.evidenceCount) ? reputation.evidenceCount : (successCount + failureCount);

  if (evidenceCount < 1) {
    return 'No delivery evidence';
  }

  const rate = Number.isFinite(reputation?.successRatePercent)
    ? `${reputation.successRatePercent}% success`
    : null;
  const attempts = `${successCount} ok / ${failureCount} failed`;
  return rate ? `${attempts} (${rate})` : attempts;
}

export function formatSourceUserConfidence(reputation) {
  switch (reputation?.confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    default:
      return 'No evidence';
  }
}

export function formatSourceUserNotes(entry) {
  if (typeof entry?.operatorNotes === 'string' && entry.operatorNotes.trim()) {
    return entry.operatorNotes;
  }

  if (typeof entry?.blockReason === 'string' && entry.blockReason.trim()) {
    return entry.blockReason;
  }

  return '—';
}

export function formatSourceUserUpdatedAt(timestamp) {
  return timestamp ? formatOperationTimestamp(timestamp) : '—';
}

export function formatSourceUserHistoryKind(kind) {
  switch (kind) {
    case 'delivery_evidence':
      return 'Delivery evidence';
    case 'manual_override':
      return 'Manual override';
    default:
      return 'Recorded event';
  }
}

export function formatSourceUserHistoryTone(entry) {
  if (entry?.kind === 'manual_override') {
    return entry?.trustState === 'trusted' ? 'success' : 'info';
  }

  if (entry?.outcome === 'failure') {
    return 'danger';
  }

  if (entry?.outcome === 'success') {
    return 'success';
  }

  return 'muted';
}

export function formatSourceUserHistorySummary(entry) {
  if (entry?.kind === 'manual_override') {
    if (entry?.trustState === 'trusted') {
      return entry?.reason ?? 'Operator marked this peer as trusted.';
    }

    return entry?.reason ?? 'Operator reset this peer to neutral.';
  }

  if (entry?.outcome === 'failure') {
    return entry?.reason ?? 'A delivery failure was recorded.';
  }

  if (entry?.outcome === 'success') {
    return entry?.reason ?? 'A successful delivery was recorded.';
  }

  return entry?.reason ?? 'No additional detail recorded.';
}

export function formatSourceUserHistoryActor(entry) {
  return typeof entry?.actorUserId === 'string' && entry.actorUserId.trim()
    ? entry.actorUserId
    : 'System';
}

export function canPromoteSourceUserTrust(entry) {
  return entry?.trustState !== 'blocked' && entry?.trustState !== 'trusted';
}

export function canResetSourceUserTrust(entry) {
  return entry?.trustState !== 'blocked' && entry?.trustState !== 'neutral';
}

export function filterSourceUsers(entries, { filter = 'all', query = '' } = {}) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';

  return entries.filter((entry) => {
    if (filter === 'blocked' && entry?.trustState !== 'blocked') {
      return false;
    }
    if (filter === 'trusted' && entry?.trustState !== 'trusted') {
      return false;
    }
    if (filter === 'watch' && entry?.review?.state !== 'watch') {
      return false;
    }
    if (filter === 'unknown' && entry?.review?.state !== 'unknown') {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      entry?.username,
      entry?.trustState,
      entry?.blockReason,
      entry?.operatorNotes,
      entry?.review?.reason,
      entry?.review?.state,
      entry?.reputation?.reliability,
    ]
      .filter((value) => typeof value === 'string' && value.length > 0)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}
