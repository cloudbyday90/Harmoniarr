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

import { buildSourceUserUsernameKey, mapSourceUserTrustRow, resolveSourceUserTrustState } from './source-user-trust-service.js';
import { HISTORY_RETENTION_MS, MAX_TRUST_HISTORY_ENTRIES } from './trust-history-constants.js';
const normalizeOptionalString = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() || null : null;
const toNonNegativeInteger = value => Math.max(0, Number.parseInt(String(value ?? ''), 10) || 0);

function compactExpiredEntries(rows) {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  return rows.filter((row) => {
    if (row.kind === 'manual_override' || row.kind === 'blocklist_event') {
      return true;
    }

    const timestamp = typeof row.occurredAt === 'string' ? Date.parse(row.occurredAt) : 0;
    return timestamp >= cutoff;
  });
}

function normalizeTrustHistory(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return compactExpiredEntries(
    rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({ ...row })),
  )
    .sort((a, b) => {
      const timeA = typeof a.occurredAt === 'string' ? Date.parse(a.occurredAt) : 0;
      const timeB = typeof b.occurredAt === 'string' ? Date.parse(b.occurredAt) : 0;
      return timeB - timeA;
    })
    .slice(0, MAX_TRUST_HISTORY_ENTRIES);
}

function appendTrustHistory(row, entry) {
  return normalizeTrustHistory([entry, ...(Array.isArray(row?.trustHistory) ? row.trustHistory : [])]);
}

function resolveReviewState(row) {
  return mapSourceUserTrustRow(row).review?.state ?? null;
}

export function applySourceUserOutcomeEvidence(rows, { actorUserId = null, eventType, occurredAt, outcome, reason, username, id = null }) {
  const normalizedUsername = username;
  const usernameKey = buildSourceUserUsernameKey(username);
  const existingIndex = rows.findIndex((row) => buildSourceUserUsernameKey(row?.username) === usernameKey);
  const existing = existingIndex >= 0 ? rows[existingIndex] : null;
  const previousReviewState = existing ? resolveReviewState(existing) : null;
  const updatedAt = typeof occurredAt === 'string' && occurredAt.trim() ? occurredAt : new Date().toISOString();
  const normalizedReason = normalizeOptionalString(reason);
  const normalizedEventType = normalizeOptionalString(eventType);
  const historyEntry = {
    actorUserId,
    eventType: normalizedEventType,
    id: id ?? `${updatedAt}:${normalizedEventType ?? outcome}:${outcome}:${toNonNegativeInteger(existing?.successCount) + toNonNegativeInteger(existing?.failureCount) + 1}`,
    kind: 'delivery_evidence',
    occurredAt: updatedAt,
    outcome,
    reason: normalizedReason,
  };
  const nextRow = {
    ...(existing ?? {}),
    failureCount: toNonNegativeInteger(existing?.failureCount) + (outcome === 'failure' ? 1 : 0),
    isBlocked: existing?.isBlocked === true,
    lastEvidenceAt: updatedAt,
    lastEvidenceEventType: normalizedEventType,
    lastEvidenceOutcome: outcome,
    lastEvidenceReason: normalizedReason,
    successCount: toNonNegativeInteger(existing?.successCount) + (outcome === 'success' ? 1 : 0),
    trustHistory: appendTrustHistory(existing, historyEntry),
    trustState: resolveSourceUserTrustState(existing),
    updatedAt,
    username: existing?.username ?? normalizedUsername,
    ...(outcome === 'success'
      ? {
        lastSuccessfulAt: updatedAt,
        lastSuccessfulEventType: normalizedEventType,
        lastSuccessfulReason: normalizedReason,
      }
      : {
        lastFailureAt: updatedAt,
        lastFailureEventType: normalizedEventType,
        lastFailureReason: normalizedReason,
      }),
  };

  if (existingIndex >= 0) {
    rows.splice(existingIndex, 1, nextRow);
  } else {
    rows.push(nextRow);
  }

  return { nextRow, previousReviewState };
}
