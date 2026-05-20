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

import { createApiError } from '../auth.js';

const TRUST_STATE_FILTERS = new Set(['blocked', 'neutral', 'trusted']);
const REVIEW_PRIORITY = Object.freeze({
  excluded: 0,
  watch: 1,
  preferred: 2,
  healthy: 3,
  normal: 4,
  unknown: 5,
});

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeQuery(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'q must be a string');
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized || null;
}

function normalizeTrustStateFilter(value) {
  if (value == null || value === '' || value === 'all') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'trustState must be a string');
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!TRUST_STATE_FILTERS.has(normalized)) {
    throw createApiError(400, 'validation_error', 'trustState must be one of blocked, neutral, or trusted');
  }

  return normalized;
}

function normalizeSnapshotRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({ ...row }));
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.trunc(number);
}

function resolveTrustState(row) {
  if (row?.isBlocked === true || row?.trustState === 'blocked') {
    return 'blocked';
  }

  if (row?.trustState === 'trusted') {
    return 'trusted';
  }

  return 'neutral';
}

function buildReputation({ failureCount, successCount }) {
  const evidenceCount = successCount + failureCount;
  const successRate = evidenceCount > 0 ? successCount / evidenceCount : null;
  const successRatePercent = successRate === null
    ? null
    : Math.round(successRate * 1000) / 10;

  let confidence = 'none';
  if (evidenceCount >= 10) {
    confidence = 'high';
  } else if (evidenceCount >= 3) {
    confidence = 'medium';
  } else if (evidenceCount > 0) {
    confidence = 'low';
  }

  const reliability = evidenceCount === 0
    ? 'unknown'
    : successRate >= 0.9 && evidenceCount >= 5
      ? 'strong'
      : successRate >= 0.7
        ? 'good'
        : successRate >= 0.4
          ? 'mixed'
          : 'poor';

  return {
    confidence,
    evidenceCount,
    failureCount,
    reliability,
    successCount,
    successRate,
    successRatePercent,
  };
}

function buildReview({ blockReason, reputation, trustState }) {
  if (trustState === 'blocked') {
    return {
      reason: blockReason || 'Operator blocked this peer from future trust decisions.',
      state: 'excluded',
    };
  }

  if (trustState === 'trusted') {
    return {
      reason: 'Operator marked this peer as trusted.',
      state: 'preferred',
    };
  }

  if (reputation.evidenceCount === 0) {
    return {
      reason: 'No delivery evidence recorded yet.',
      state: 'unknown',
    };
  }

  if (reputation.failureCount >= 3 && (reputation.successRate ?? 1) < 0.5) {
    return {
      reason: `${reputation.failureCount} failures across ${reputation.evidenceCount} recorded attempts.`,
      state: 'watch',
    };
  }

  if (reputation.evidenceCount >= 5 && (reputation.successRate ?? 0) >= 0.8) {
    return {
      reason: `${reputation.successCount} successful deliveries across ${reputation.evidenceCount} attempts.`,
      state: 'healthy',
    };
  }

  if (reputation.evidenceCount >= 3 && reputation.failureCount > reputation.successCount) {
    return {
      reason: `Failures currently outweigh successes (${reputation.failureCount}/${reputation.evidenceCount}).`,
      state: 'watch',
    };
  }

  return {
    reason: `Mixed delivery evidence across ${reputation.evidenceCount} attempts.`,
    state: 'normal',
  };
}

function mapSourceUser(row) {
  const trustState = resolveTrustState(row);
  const reputation = buildReputation({
    failureCount: toNonNegativeInteger(row?.failureCount),
    successCount: toNonNegativeInteger(row?.successCount),
  });
  const review = buildReview({
    blockReason: row?.blockReason ?? row?.reason ?? '',
    reputation,
    trustState,
  });

  return {
    blockedAt: row?.blockedAt ?? null,
    blockedByUserId: row?.blockedByUserId ?? null,
    blockReason: row?.blockReason ?? row?.reason ?? null,
    isBlocked: trustState === 'blocked',
    operatorNotes: row?.operatorNotes ?? row?.notes ?? null,
    reputation,
    review,
    trustState,
    unblockedAt: row?.unblockedAt ?? null,
    unblockedByUserId: row?.unblockedByUserId ?? null,
    updatedAt: row?.updatedAt ?? row?.blockedAt ?? row?.unblockedAt ?? null,
    username: typeof row?.username === 'string' ? row.username : '',
  };
}

function buildSearchText(row) {
  return [
    row.username,
    row.trustState,
    row.blockReason,
    row.operatorNotes,
    row.review?.reason,
    row.review?.state,
    row.reputation?.reliability,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

function sortSourceUsers(a, b) {
  const priorityA = REVIEW_PRIORITY[a.review?.state] ?? 99;
  const priorityB = REVIEW_PRIORITY[b.review?.state] ?? 99;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  if (updatedA !== updatedB) {
    return updatedB - updatedA;
  }

  return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
}

function summarizeSourceUsers(rows) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    summary[row.trustState] += 1;
    if (row.review?.state === 'watch') {
      summary.needsReview += 1;
    }
    if (row.review?.state === 'preferred') {
      summary.preferred += 1;
    }
    if (row.review?.state === 'unknown') {
      summary.unknown += 1;
    }
    if ((row.reputation?.evidenceCount ?? 0) > 0) {
      summary.withEvidence += 1;
    }
    return summary;
  }, {
    blocked: 0,
    needsReview: 0,
    neutral: 0,
    preferred: 0,
    total: 0,
    trusted: 0,
    unknown: 0,
    withEvidence: 0,
  });
}

export function createSourceUserTrustService({
  listTrustSnapshot = async () => [],
} = {}) {
  async function listSourceUsers({ query, trustState } = {}) {
    const normalizedQuery = normalizeQuery(query);
    const normalizedTrustState = normalizeTrustStateFilter(trustState);
    const sourceUsers = normalizeSnapshotRows(await listTrustSnapshot())
      .map(mapSourceUser)
      .filter((row) => (normalizedTrustState ? row.trustState === normalizedTrustState : true))
      .filter((row) => (normalizedQuery ? buildSearchText(row).includes(normalizedQuery) : true))
      .sort(sortSourceUsers);

    return {
      checkedAt: new Date().toISOString(),
      counts: summarizeSourceUsers(sourceUsers),
      query: normalizedQuery,
      sourceUsers,
      total: sourceUsers.length,
      trustState: normalizedTrustState,
    };
  }

  return {
    listSourceUsers,
  };
}
