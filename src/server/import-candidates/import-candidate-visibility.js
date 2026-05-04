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

function normalizeUserId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveImportCandidateRequestOwnership(candidate) {
  const requestOwnership = candidate?.normalizedPayload?.requestOwnership;
  if (!requestOwnership || typeof requestOwnership !== 'object') {
    return null;
  }

  const sourceRequestedForUserId = normalizeUserId(requestOwnership.sourceRequestedForUserId);
  if (!sourceRequestedForUserId) {
    return null;
  }

  return {
    sourceMediaRequestId: normalizeUserId(requestOwnership.sourceMediaRequestId) || null,
    sourceRequestKind: typeof requestOwnership.sourceRequestKind === 'string'
      ? requestOwnership.sourceRequestKind.trim() || null
      : null,
    sourceRequestedByUserId: normalizeUserId(requestOwnership.sourceRequestedByUserId) || null,
    sourceRequestedForUserId,
    sourceType: typeof requestOwnership.sourceType === 'string'
      ? requestOwnership.sourceType.trim() || null
      : null,
  };
}

export function buildImportCandidateVisibilityFilter({ actorUserId = null, actorUserRole = null } = {}) {
  if (actorUserRole === 'admin') {
    return {
      requestedForUserId: null,
    };
  }

  return {
    requestedForUserId: normalizeUserId(actorUserId) || null,
  };
}

export function canViewImportCandidate({ actorUserId = null, actorUserRole = null, candidate } = {}) {
  if (actorUserRole === 'admin') {
    return true;
  }

  const requestOwnership = resolveImportCandidateRequestOwnership(candidate);
  if (!requestOwnership) {
    return false;
  }

  return requestOwnership.sourceRequestedForUserId === normalizeUserId(actorUserId);
}

export function assertImportCandidateVisible({ actorUserId = null, actorUserRole = null, candidate } = {}) {
  if (!canViewImportCandidate({ actorUserId, actorUserRole, candidate })) {
    throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
  }
}