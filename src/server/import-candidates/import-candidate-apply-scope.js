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

export const MAX_IMPORT_CANDIDATE_APPLY_SCOPE_SIZE = 25;

function normalizeCandidateId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectCandidateIds(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value
    .map(normalizeCandidateId)
    .filter((candidateId) => candidateId.length > 0 && candidateId.length <= 100))];
}

/**
 * Validates an explicit apply scope before it is persisted to an operation
 * run. The normal manual path leaves the scope unset; only server-owned
 * automation supplies a bounded list.
 */
export function normalizeImportCandidateApplyScope(value) {
  if (value == null) {
    return null;
  }

  const candidateIds = collectCandidateIds(value);
  if (!candidateIds || candidateIds.length === 0) {
    throw createApiError(400, 'validation_error', 'importCandidateIds must contain at least one candidate');
  }

  if (candidateIds.length > MAX_IMPORT_CANDIDATE_APPLY_SCOPE_SIZE) {
    throw createApiError(
      400,
      'validation_error',
      `importCandidateIds must contain ${MAX_IMPORT_CANDIDATE_APPLY_SCOPE_SIZE} candidates or fewer`,
    );
  }

  return candidateIds;
}

/**
 * Operation summaries are durable data. Treat malformed stored scopes as an
 * empty scope rather than falling back to an unbounded run.
 */
export function readImportCandidateApplyScope(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  return collectCandidateIds(value).slice(0, MAX_IMPORT_CANDIDATE_APPLY_SCOPE_SIZE);
}
