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

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Builds the request-facing Activity event only after the library add succeeds.
 * A request route still authorizes the destination; this payload merely carries
 * the durable request identifier needed to offer that handoff.
 */
export function buildRequestFulfilledActivityEvent({ candidate = null } = {}) {
  const requestOwnership = candidate?.requestOwnership && typeof candidate.requestOwnership === 'object'
    ? candidate.requestOwnership
    : {};
  const requestId = normalizeOptionalString(requestOwnership.sourceMediaRequestId);
  const requestedForUserId = normalizeOptionalString(requestOwnership.sourceRequestedForUserId)
    ?? normalizeOptionalString(requestOwnership.sourceRequestedByUserId);

  if (!requestedForUserId) {
    return null;
  }

  return {
    actorUserId: null,
    entityArtist: normalizeOptionalString(candidate?.releaseIdentity?.artistName),
    entityId: requestId ?? normalizeOptionalString(candidate?.id),
    entityTitle: normalizeOptionalString(candidate?.releaseIdentity?.releaseTitle),
    entityType: requestId ? 'media_request' : 'import_candidate',
    eventType: 'request_fulfilled',
    extraPayload: {
      requestedForUserId,
      schemaVersion: 1,
      ...(requestId ? { sourceMediaRequestId: requestId } : {}),
    },
  };
}
