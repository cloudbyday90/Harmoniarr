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

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

import {
  buildSourceUserUsernameKey,
  normalizeSourceUserTrustSnapshotRows,
  resolveSourceUserTrustState,
} from './source-user-trust-service.js';
import { HISTORY_RETENTION_MS, MAX_TRUST_HISTORY_ENTRIES } from './trust-history-constants.js';

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function mapReputationRow(row) {
  return {
    failureCount: toNonNegativeInteger(row?.failureCount),
    successCount: toNonNegativeInteger(row?.successCount),
    trustState: resolveSourceUserTrustState(row),
    username: normalizeOptionalString(row?.username),
  };
}

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

export function createSourceUserTrustEvidenceService({
  listTrustSnapshot = async () => [],
  replaceTrustSnapshot = async () => {},
} = {}) {
  async function listSourceUserReputationIndex({ usernames } = {}) {
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const usernameFilter = Array.isArray(usernames)
      ? new Set(usernames.map((value) => buildSourceUserUsernameKey(value)).filter(Boolean))
      : null;
    const reputationIndex = new Map();

    for (const row of rows) {
      const reputation = mapReputationRow(row);
      const usernameKey = buildSourceUserUsernameKey(reputation.username);
      if (!usernameKey) {
        continue;
      }

      if (usernameFilter && !usernameFilter.has(usernameKey)) {
        continue;
      }

      reputationIndex.set(usernameKey, reputation);
    }

    return reputationIndex;
  }

  async function recordSourceUserOutcomeEvidence({
    actorUserId = null,
    eventType = null,
    occurredAt = new Date().toISOString(),
    outcome,
    reason = null,
    username,
  } = {}) {
    const normalizedUsername = normalizeOptionalString(username);
    if (!normalizedUsername || (outcome !== 'success' && outcome !== 'failure')) {
      return null;
    }

    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => buildSourceUserUsernameKey(row?.username) === usernameKey);
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;
    const updatedAt = typeof occurredAt === 'string' && occurredAt.trim() ? occurredAt : new Date().toISOString();
    const normalizedReason = normalizeOptionalString(reason);
    const normalizedEventType = normalizeOptionalString(eventType);
    const historyEntry = {
      actorUserId,
      eventType: normalizedEventType,
      id: `${updatedAt}:${normalizedEventType ?? outcome}:${outcome}:${toNonNegativeInteger(existing?.successCount) + toNonNegativeInteger(existing?.failureCount) + 1}`,
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

    await replaceTrustSnapshot({ sourceUsers: rows });
    return nextRow;
  }

  return {
    listSourceUserReputationIndex,
    recordSourceUserOutcomeEvidence,
  };
}
