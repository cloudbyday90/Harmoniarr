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
  resolveSourceUserTrustState,
} from './source-user-trust-service.js';

const ALLOWED_TRUST_STATES = new Set(['neutral', 'trusted']);
const MAX_REASON_LENGTH = 400;
const MAX_NOTES_LENGTH = 1000;
const MAX_HISTORY_ENTRIES = 25;

function normalizeRequiredText(value, fieldName, maxLength) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or less`);
  }

  return normalized;
}

function normalizeOptionalText(value, fieldName, maxLength) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or less`);
  }

  return normalized;
}

function normalizeTrustState(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'trustState must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!ALLOWED_TRUST_STATES.has(normalized)) {
    throw createApiError(400, 'validation_error', 'trustState must be either neutral or trusted');
  }

  return normalized;
}

function normalizeTrustHistory(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({ ...entry }))
    .sort((a, b) => {
      const timeA = typeof a.occurredAt === 'string' ? Date.parse(a.occurredAt) : 0;
      const timeB = typeof b.occurredAt === 'string' ? Date.parse(b.occurredAt) : 0;
      return timeB - timeA;
    })
    .slice(0, MAX_HISTORY_ENTRIES);
}

export function createSourceUserTrustOverrideService({
  listTrustSnapshot = async () => [],
  replaceTrustSnapshot = async () => {},
} = {}) {
  async function updateSourceUserTrust({ actorUserId = null, operatorNotes = null, reason, trustState, username } = {}) {
    const normalizedUsername = normalizeRequiredText(username, 'username', 128);
    const normalizedReason = normalizeRequiredText(reason, 'reason', MAX_REASON_LENGTH);
    const normalizedNotes = normalizeOptionalText(operatorNotes, 'operatorNotes', MAX_NOTES_LENGTH);
    const normalizedTrustState = normalizeTrustState(trustState);
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => buildSourceUserUsernameKey(row?.username) === usernameKey);
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;

    if (resolveSourceUserTrustState(existing) === 'blocked') {
      throw createApiError(409, 'source_user_trust_blocked_use_blocklist', 'Blocked source users must be managed from the blocklist workflow first');
    }

    const updatedAt = new Date().toISOString();
    const historyEntry = {
      actorUserId,
      eventType: 'source_user_trust_overridden',
      id: `${updatedAt}:manual_override:${normalizedTrustState}:${rows.length + 1}`,
      kind: 'manual_override',
      occurredAt: updatedAt,
      operatorNotes: normalizedNotes,
      reason: normalizedReason,
      trustState: normalizedTrustState,
    };
    const nextRow = {
      ...(existing ?? {}),
      isBlocked: false,
      lastManualDecisionAt: updatedAt,
      lastManualDecisionByUserId: actorUserId,
      lastManualDecisionReason: normalizedReason,
      operatorNotes: normalizedNotes,
      trustHistory: normalizeTrustHistory([historyEntry, ...(Array.isArray(existing?.trustHistory) ? existing.trustHistory : [])]),
      trustState: normalizedTrustState,
      updatedAt,
      username: existing?.username ?? normalizedUsername,
    };

    if (existingIndex >= 0) {
      rows.splice(existingIndex, 1, nextRow);
    } else {
      rows.push(nextRow);
    }

    await replaceTrustSnapshot({ sourceUsers: rows });

    return {
      sourceUser: mapSourceUserTrustRow(nextRow),
    };
  }

  return {
    updateSourceUserTrust,
  };
}
