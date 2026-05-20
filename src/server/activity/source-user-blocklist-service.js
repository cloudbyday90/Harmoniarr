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

const MAX_USERNAME_LENGTH = 128;
const MAX_REASON_LENGTH = 400;
const MAX_NOTES_LENGTH = 1000;

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'username must be a string');
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'username is required');
  }

  if (normalized.length > MAX_USERNAME_LENGTH) {
    throw createApiError(400, 'validation_error', `username must be ${MAX_USERNAME_LENGTH} characters or less`);
  }

  return normalized;
}

function normalizeReason(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'reason must be a string');
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'reason is required');
  }

  if (normalized.length > MAX_REASON_LENGTH) {
    throw createApiError(400, 'validation_error', `reason must be ${MAX_REASON_LENGTH} characters or less`);
  }

  return normalized;
}

function normalizeOperatorNotes(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'operatorNotes must be a string');
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTES_LENGTH) {
    throw createApiError(400, 'validation_error', `operatorNotes must be ${MAX_NOTES_LENGTH} characters or less`);
  }

  return normalized;
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

function normalizeSnapshotRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({ ...row }));
}

function getUsernameKey(username) {
  return normalizeWhitespace(String(username ?? '')).toLowerCase();
}

function isBlockedSourceUser(row) {
  return row?.isBlocked === true || row?.trustState === 'blocked';
}

function mapBlockedSourceUser(row) {
  return {
    blockedAt: row.blockedAt ?? row.updatedAt ?? null,
    blockedByUserId: row.blockedByUserId ?? null,
    blockReason: row.blockReason ?? row.reason ?? '',
    isBlocked: true,
    operatorNotes: row.operatorNotes ?? row.notes ?? null,
    trustState: 'blocked',
    updatedAt: row.updatedAt ?? row.blockedAt ?? null,
    username: row.username ?? '',
  };
}

function buildSearchText(row) {
  return [
    row.username,
    row.blockReason,
    row.operatorNotes,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

function sortBlockedSourceUsers(a, b) {
  const aTime = a.blockedAt ? new Date(a.blockedAt).getTime() : 0;
  const bTime = b.blockedAt ? new Date(b.blockedAt).getTime() : 0;

  if (aTime !== bTime) {
    return bTime - aTime;
  }

  return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
}

export function createSourceUserBlocklistService({
  listTrustSnapshot = async () => [],
  replaceTrustSnapshot = async () => {},
} = {}) {
  async function listBlockedSourceUsers({ query } = {}) {
    const normalizedQuery = normalizeQuery(query);
    const rows = normalizeSnapshotRows(await listTrustSnapshot());
    const blockedSourceUsers = rows
      .filter(isBlockedSourceUser)
      .map(mapBlockedSourceUser)
      .filter((row) => (normalizedQuery ? buildSearchText(row).includes(normalizedQuery) : true))
      .sort(sortBlockedSourceUsers);

    return {
      blockedSourceUsers,
      checkedAt: new Date().toISOString(),
      query: normalizedQuery,
      total: blockedSourceUsers.length,
    };
  }

  async function blockSourceUser({ actorUserId = null, operatorNotes = null, reason, username } = {}) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedReason = normalizeReason(reason);
    const normalizedNotes = normalizeOperatorNotes(operatorNotes);
    const usernameKey = getUsernameKey(normalizedUsername);
    const rows = normalizeSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => getUsernameKey(row.username) === usernameKey);
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;
    const wasBlocked = isBlockedSourceUser(existing);
    const nowIso = new Date().toISOString();
    const nextRow = {
      ...(existing ?? {}),
      blockedAt: wasBlocked ? (existing.blockedAt ?? nowIso) : nowIso,
      blockedByUserId: wasBlocked ? (existing.blockedByUserId ?? actorUserId ?? null) : (actorUserId ?? null),
      blockReason: normalizedReason,
      isBlocked: true,
      operatorNotes: normalizedNotes,
      trustState: 'blocked',
      updatedAt: nowIso,
      username: normalizedUsername,
    };

    if (existingIndex >= 0) {
      rows.splice(existingIndex, 1, nextRow);
    } else {
      rows.push(nextRow);
    }

    await replaceTrustSnapshot({ sourceUsers: rows });

    return {
      sourceUser: mapBlockedSourceUser(nextRow),
    };
  }

  async function unblockSourceUser({ actorUserId = null, username } = {}) {
    const normalizedUsername = normalizeUsername(username);
    const usernameKey = getUsernameKey(normalizedUsername);
    const rows = normalizeSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => getUsernameKey(row.username) === usernameKey);

    if (existingIndex < 0 || !isBlockedSourceUser(rows[existingIndex])) {
      throw createApiError(404, 'source_user_block_not_found', 'Blocked source user was not found');
    }

    const existing = rows[existingIndex];
    const nextRow = {
      ...existing,
      blockedAt: null,
      blockedByUserId: null,
      blockReason: null,
      isBlocked: false,
      trustState: existing.trustState === 'blocked' ? 'neutral' : existing.trustState,
      unblockedAt: new Date().toISOString(),
      unblockedByUserId: actorUserId ?? null,
      updatedAt: new Date().toISOString(),
      username: existing.username ?? normalizedUsername,
    };

    rows.splice(existingIndex, 1, nextRow);
    await replaceTrustSnapshot({ sourceUsers: rows });

    return {
      sourceUser: {
        username: nextRow.username,
      },
    };
  }

  return {
    blockSourceUser,
    listBlockedSourceUsers,
    unblockSourceUser,
  };
}
