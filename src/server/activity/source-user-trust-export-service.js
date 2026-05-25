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

const CSV_COLUMNS = [
  'occurredAt',
  'kind',
  'eventType',
  'outcome',
  'trustState',
  'actorUserId',
  'reason',
  'operatorNotes',
];

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
      return timeA - timeB;
    });
}

function escapeCsvField(value) {
  if (value == null) {
    return '';
  }

  const str = String(value);

  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsvRow(entry) {
  return CSV_COLUMNS
    .map((col) => escapeCsvField(entry[col]))
    .join(',');
}

function buildCsvExport(username, snapshotRow) {
  const history = normalizeTrustHistory(snapshotRow.trustHistory);
  const header = CSV_COLUMNS.join(',');
  const rows = history.map(buildCsvRow);
  const csvContent = [header, ...rows].join('\r\n');

  return {
    exportedAt: new Date().toISOString(),
    filename: `trust-history-${username.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`,
    mediaType: 'text/csv',
    payload: csvContent,
    totalEntries: history.length,
    username,
  };
}

function buildJsonExport(username, snapshotRow) {
  const history = normalizeTrustHistory(snapshotRow.trustHistory);
  const mappedRow = mapSourceUserTrustRow(snapshotRow);

  return {
    exportedAt: new Date().toISOString(),
    filename: `trust-history-${username.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`,
    mediaType: 'application/json',
    payload: {
      exportedAt: new Date().toISOString(),
      sourceUser: {
        ...mappedRow,
        trustHistory: history,
      },
      totalEntries: history.length,
      username,
    },
    totalEntries: history.length,
    username,
  };
}

function resolveFormat(acceptHeader, formatParam) {
  if (typeof formatParam === 'string') {
    const normalized = formatParam.trim().toLowerCase();
    if (normalized === 'csv') {
      return 'csv';
    }

    if (normalized === 'json') {
      return 'json';
    }

    throw createApiError(400, 'validation_error', 'format must be csv or json');
  }

  if (typeof acceptHeader === 'string') {
    if (acceptHeader.includes('text/csv')) {
      return 'csv';
    }
  }

  return 'json';
}

export function createSourceUserTrustExportService({
  listTrustSnapshot = async () => [],
} = {}) {
  async function exportSourceUserTrustHistory({ username, accept, format } = {}) {
    const normalizedUsername = normalizeUsername(username);
    const resolvedFormat = resolveFormat(accept, format);
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const row = rows.find((entry) => buildSourceUserUsernameKey(entry?.username) === usernameKey);

    if (!row) {
      throw createApiError(404, 'source_user_not_found', 'Source user was not found');
    }

    if (resolvedFormat === 'csv') {
      return buildCsvExport(normalizedUsername, row);
    }

    return buildJsonExport(normalizedUsername, row);
  }

  return {
    exportSourceUserTrustHistory,
  };
}
