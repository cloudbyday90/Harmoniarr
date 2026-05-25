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

const MAX_BATCH_SIZE = 50;

function normalizeUsernames(value) {
  if (!Array.isArray(value)) {
    throw createApiError(400, 'validation_error', 'usernames must be an array');
  }

  if (value.length === 0) {
    throw createApiError(400, 'validation_error', 'usernames must contain at least one entry');
  }

  if (value.length > MAX_BATCH_SIZE) {
    throw createApiError(400, 'validation_error', `usernames must contain ${MAX_BATCH_SIZE} entries or less`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw createApiError(400, 'validation_error', `usernames[${index}] must be a string`);
    }

    const normalized = entry.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      throw createApiError(400, 'validation_error', `usernames[${index}] must not be empty`);
    }

    return normalized;
  });
}

function normalizeReason(value) {
  if (value == null || value === '') {
    throw createApiError(400, 'validation_error', 'reason is required');
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'reason must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', 'reason is required');
  }

  if (normalized.length > 400) {
    throw createApiError(400, 'validation_error', 'reason must be 400 characters or less');
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

export function createSourceUserBulkOperationService({
  blockSourceUser = async () => {},
  updateSourceUserTrust = async () => {},
} = {}) {
  async function bulkUpdateSourceUserTrust({ actorUserId = null, operatorNotes = null, reason, trustState, usernames } = {}) {
    const normalizedUsernames = normalizeUsernames(usernames);
    const normalizedReason = normalizeReason(reason);
    const normalizedNotes = normalizeOptionalText(operatorNotes, 'operatorNotes', 1000);

    const results = [];
    for (const username of normalizedUsernames) {
      try {
        const result = await updateSourceUserTrust({
          actorUserId,
          operatorNotes: normalizedNotes,
          reason: normalizedReason,
          trustState,
          username,
        });
        results.push({ ok: true, username, ...result });
      } catch (error) {
        results.push({
          error: { code: error?.code ?? 'unknown_error', message: error?.message ?? 'Unknown error', status: error?.status ?? 500 },
          ok: false,
          username,
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return {
      failed,
      results,
      succeeded,
      total: results.length,
    };
  }

  async function bulkBlockSourceUsers({ actorUserId = null, operatorNotes = null, reason, usernames } = {}) {
    const normalizedUsernames = normalizeUsernames(usernames);
    const normalizedReason = normalizeReason(reason);
    const normalizedNotes = normalizeOptionalText(operatorNotes, 'operatorNotes', 1000);

    const results = [];
    for (const username of normalizedUsernames) {
      try {
        const result = await blockSourceUser({
          actorUserId,
          operatorNotes: normalizedNotes,
          reason: normalizedReason,
          username,
        });
        results.push({ ok: true, username, ...result });
      } catch (error) {
        results.push({
          error: { code: error?.code ?? 'unknown_error', message: error?.message ?? 'Unknown error', status: error?.status ?? 500 },
          ok: false,
          username,
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return {
      failed,
      results,
      succeeded,
      total: results.length,
    };
  }

  return {
    bulkBlockSourceUsers,
    bulkUpdateSourceUserTrust,
  };
}
