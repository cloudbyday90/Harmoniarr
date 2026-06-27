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

import { recordAuditEvent } from '../audit.js';
import { createApiError } from '../auth.js';
import { hasAppUserPermission } from '../app-user-permission-service.js';
import { createLibraryReleaseVisibilityStore } from './library-release-visibility-store.js';

const VALID_VISIBILITY_STATES = new Set(['visible', 'removed']);
const MAX_REASON_LENGTH = 500;

function normalizeVisibilityState(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'visibilityState must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!VALID_VISIBILITY_STATES.has(normalized)) {
    throw createApiError(400, 'validation_error', 'visibilityState must be visible or removed');
  }

  return normalized;
}

function normalizeReason(value) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'reason must be a string');
  }

  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > MAX_REASON_LENGTH) {
    throw createApiError(400, 'validation_error', `reason must be ${MAX_REASON_LENGTH} characters or less`);
  }

  return normalized;
}

function assertOperatorLibraryAccess({ actorUserId, actorUserRole }) {
  if (!actorUserId) {
    throw createApiError(401, 'auth_required', 'A signed-in user is required');
  }

  if (!hasAppUserPermission({ role: actorUserRole }, 'library.scan')) {
    throw createApiError(403, 'forbidden', 'Only operators can change library visibility');
  }
}

function buildVisibilitySummary({ target, visibilityState }) {
  const title = target.releaseTitle ?? target.releaseGroupTitle ?? 'Unknown release';
  const artist = target.artistName ? ` by ${target.artistName}` : '';
  const action = visibilityState === 'removed' ? 'removed from' : 'restored to';
  return `${title}${artist} ${action} the operator library view`;
}

export function createLibraryReleaseVisibilityService({
  libraryReleaseVisibilityStore = createLibraryReleaseVisibilityStore(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function setLibraryReleaseVisibility({
    actorUserId,
    actorUserRole,
    metadataReleaseId,
    reason = null,
    requestMetadata = {},
    visibilityState,
  }) {
    assertOperatorLibraryAccess({ actorUserId, actorUserRole });

    if (typeof metadataReleaseId !== 'string' || metadataReleaseId.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'metadataReleaseId is required');
    }

    const normalizedVisibilityState = normalizeVisibilityState(visibilityState);
    const normalizedReason = normalizeReason(reason);
    const target = await libraryReleaseVisibilityStore.getLibraryReleaseVisibilityTarget({
      metadataReleaseId,
    });

    if (!target) {
      throw createApiError(404, 'library_release_not_found', 'The specified library release could not be found');
    }

    const visibility = await libraryReleaseVisibilityStore.setLibraryReleaseVisibility({
      appUserId: actorUserId,
      metadataReleaseId,
      reason: normalizedReason,
      updatedByUserId: actorUserId,
      visibilityState: normalizedVisibilityState,
    });

    if (typeof recordAuditEventFn === 'function') {
      await recordAuditEventFn({
        actorType: 'app_user',
        actorUserId,
        details: {
          metadataArtistId: target.metadataArtistId,
          metadataReleaseGroupId: target.metadataReleaseGroupId,
          metadataReleaseId: target.metadataReleaseId,
          reason: normalizedReason,
          visibilityState: normalizedVisibilityState,
        },
        entityId: target.metadataReleaseId,
        entityType: 'metadata_release',
        eventType: normalizedVisibilityState === 'removed'
          ? 'operator_library_release_removed'
          : 'operator_library_release_restored',
        ipAddress: requestMetadata.ipAddress ?? null,
        summary: buildVisibilitySummary({ target, visibilityState: normalizedVisibilityState }),
        userAgent: requestMetadata.userAgent ?? null,
      });
    }

    return {
      target,
      visibility,
    };
  }

  return {
    setLibraryReleaseVisibility,
  };
}
