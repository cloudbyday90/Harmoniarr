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

function normalizeSnapshotRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({ ...row }));
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function buildUsernameKey(username) {
  return normalizeOptionalString(username)?.toLowerCase() ?? '';
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
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

function mapReputationRow(row) {
  return {
    failureCount: toNonNegativeInteger(row?.failureCount),
    successCount: toNonNegativeInteger(row?.successCount),
    trustState: resolveTrustState(row),
    username: normalizeOptionalString(row?.username),
  };
}

export function createSourceUserTrustEvidenceService({
  listTrustSnapshot = async () => [],
  replaceTrustSnapshot = async () => {},
} = {}) {
  async function listSourceUserReputationIndex({ usernames } = {}) {
    const rows = normalizeSnapshotRows(await listTrustSnapshot());
    const usernameFilter = Array.isArray(usernames)
      ? new Set(usernames.map((value) => buildUsernameKey(value)).filter(Boolean))
      : null;
    const reputationIndex = new Map();

    for (const row of rows) {
      const reputation = mapReputationRow(row);
      const usernameKey = buildUsernameKey(reputation.username);
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

    const usernameKey = buildUsernameKey(normalizedUsername);
    const rows = normalizeSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => buildUsernameKey(row?.username) === usernameKey);
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;
    const updatedAt = typeof occurredAt === 'string' && occurredAt.trim() ? occurredAt : new Date().toISOString();
    const normalizedReason = normalizeOptionalString(reason);
    const normalizedEventType = normalizeOptionalString(eventType);
    const nextRow = {
      ...(existing ?? {}),
      failureCount: toNonNegativeInteger(existing?.failureCount) + (outcome === 'failure' ? 1 : 0),
      isBlocked: existing?.isBlocked === true,
      lastEvidenceAt: updatedAt,
      lastEvidenceEventType: normalizedEventType,
      lastEvidenceOutcome: outcome,
      lastEvidenceReason: normalizedReason,
      successCount: toNonNegativeInteger(existing?.successCount) + (outcome === 'success' ? 1 : 0),
      trustState: resolveTrustState(existing),
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
