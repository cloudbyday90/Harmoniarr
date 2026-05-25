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

const SUPPORTED_ACTIONS = new Set(['select', 'hold', 'reject', 'reopen']);

function normalizeImportCandidateIds(value) {
  if (!Array.isArray(value)) {
    throw createApiError(400, 'validation_error', 'importCandidateIds must be an array');
  }

  if (value.length === 0) {
    throw createApiError(400, 'validation_error', 'importCandidateIds must contain at least one entry');
  }

  if (value.length > MAX_BATCH_SIZE) {
    throw createApiError(400, 'validation_error', `importCandidateIds must contain ${MAX_BATCH_SIZE} entries or less`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw createApiError(400, 'validation_error', `importCandidateIds[${index}] must be a string`);
    }

    const normalized = entry.trim();
    if (!normalized) {
      throw createApiError(400, 'validation_error', `importCandidateIds[${index}] must not be empty`);
    }

    return normalized;
  });
}

function normalizeAction(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'action must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_ACTIONS.has(normalized)) {
    throw createApiError(400, 'validation_error', `action must be one of: ${[...SUPPORTED_ACTIONS].join(', ')}`);
  }

  return normalized;
}

function normalizeOptionalReason(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'reason must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 400) {
    throw createApiError(400, 'validation_error', 'reason must be 400 characters or less');
  }

  return normalized;
}

export function createImportCandidateBulkReviewService({
  holdImportCandidate = async () => {},
  rejectImportCandidate = async () => {},
  reopenImportCandidate = async () => {},
  selectImportCandidate = async () => {},
} = {}) {
  const actionHandlers = {
    hold: holdImportCandidate,
    reopen: reopenImportCandidate,
    reject: rejectImportCandidate,
    select: selectImportCandidate,
  };

  async function bulkReviewImportCandidates({ action, actorUserId = null, importCandidateIds, reason = null, requestMetadata = null } = {}) {
    const normalizedIds = normalizeImportCandidateIds(importCandidateIds);
    const normalizedAction = normalizeAction(action);
    const normalizedReason = normalizeOptionalReason(reason);
    const handler = actionHandlers[normalizedAction];

    const results = [];
    for (const importCandidateId of normalizedIds) {
      try {
        const result = await handler({
          actorUserId,
          importCandidateId,
          reason: normalizedReason,
          requestMetadata,
        });
        results.push({ importCandidateId, ok: true, review: result });
      } catch (error) {
        results.push({
          error: { code: error?.code ?? 'unknown_error', message: error?.message ?? 'Unknown error', status: error?.status ?? 500 },
          importCandidateId,
          ok: false,
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return {
      action: normalizedAction,
      failed,
      results,
      succeeded,
      total: results.length,
    };
  }

  return {
    bulkReviewImportCandidates,
  };
}
