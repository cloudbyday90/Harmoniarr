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
import {
  buildSourceUserUsernameKey,
  mapSourceUserTrustRow,
  normalizeSourceUserTrustSnapshotRows,
} from './source-user-trust-service.js';
import { DEFAULT_HISTORY_PAGE_SIZE, MAX_TRUST_HISTORY_ENTRIES } from './trust-history-constants.js';

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'username must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'username is required');
  }

  return normalized;
}

function normalizeHistoryLimit(value) {
  if (value == null || value === '') {
    return DEFAULT_HISTORY_PAGE_SIZE;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TRUST_HISTORY_ENTRIES) {
    throw createApiError(400, 'validation_error', `historyLimit must be an integer between 1 and ${MAX_TRUST_HISTORY_ENTRIES}`);
  }

  return parsed;
}

function normalizeHistoryOffset(value) {
  if (value == null || value === '') {
    return 0;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TRUST_HISTORY_ENTRIES) {
    throw createApiError(400, 'validation_error', `historyOffset must be a non-negative integer up to ${MAX_TRUST_HISTORY_ENTRIES}`);
  }

  return parsed;
}

function normalizeTrustHistory(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => ({
      actorUserId: typeof entry.actorUserId === 'string' ? entry.actorUserId : null,
      eventType: typeof entry.eventType === 'string' ? entry.eventType : null,
      id: typeof entry.id === 'string' && entry.id ? entry.id : `history-${index}`,
      kind: typeof entry.kind === 'string' ? entry.kind : 'recorded_event',
      occurredAt: typeof entry.occurredAt === 'string' ? entry.occurredAt : null,
      operatorNotes: typeof entry.operatorNotes === 'string' ? entry.operatorNotes : null,
      outcome: typeof entry.outcome === 'string' ? entry.outcome : null,
      reason: typeof entry.reason === 'string' ? entry.reason : null,
      trustState: typeof entry.trustState === 'string' ? entry.trustState : null,
    }))
    .sort((a, b) => {
      const timeA = a.occurredAt ? Date.parse(a.occurredAt) : 0;
      const timeB = b.occurredAt ? Date.parse(b.occurredAt) : 0;
      return timeB - timeA;
    });
}

export function createSourceUserTrustDetailService({
  listTrustSnapshot = async () => [],
} = {}) {
  async function getSourceUserDetail({ username, historyLimit, historyOffset } = {}) {
    const normalizedUsername = normalizeUsername(username);
    const limit = normalizeHistoryLimit(historyLimit);
    const offset = normalizeHistoryOffset(historyOffset);
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const row = rows.find((entry) => buildSourceUserUsernameKey(entry?.username) === usernameKey);

    if (!row) {
      throw createApiError(404, 'source_user_not_found', 'Source user was not found');
    }

    const fullHistory = normalizeTrustHistory(row.trustHistory);
    const totalCount = fullHistory.length;
    const pagedHistory = fullHistory.slice(offset, offset + limit);

    return {
      checkedAt: new Date().toISOString(),
      sourceUser: {
        ...mapSourceUserTrustRow(row),
        trustHistory: pagedHistory,
        trustHistoryPagination: {
          limit,
          offset,
          total: totalCount,
        },
      },
    };
  }

  return {
    getSourceUserDetail,
  };
}
