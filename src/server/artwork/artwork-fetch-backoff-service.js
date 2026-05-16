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

import {
  deleteArtworkFetchFailure,
  getArtworkFetchFailure,
  upsertArtworkFetchFailure,
} from './artwork-repository.js';

const defaultBackoffScheduleMs = [
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

function normalizeFailureKey({ artworkRole, ownerId, ownerType }) {
  return {
    artworkRole: String(artworkRole ?? 'cover_front').trim(),
    ownerId: String(ownerId ?? '').trim(),
    ownerType: String(ownerType ?? '').trim(),
  };
}

function resolveBackoffDelayMs(failureCount, backoffScheduleMs) {
  const index = Math.max(0, Math.min(failureCount - 1, backoffScheduleMs.length - 1));
  return backoffScheduleMs[index];
}

export function createArtworkFetchBackoffService({
  backoffScheduleMs = defaultBackoffScheduleMs,
  deleteArtworkFetchFailureFn = deleteArtworkFetchFailure,
  getArtworkFetchFailureFn = getArtworkFetchFailure,
  nowFn = () => Date.now(),
  upsertArtworkFetchFailureFn = upsertArtworkFetchFailure,
} = {}) {
  async function getFailureState({ artworkRole, ownerId, ownerType }) {
    const normalized = normalizeFailureKey({ artworkRole, ownerId, ownerType });
    return getArtworkFetchFailureFn(normalized);
  }

  async function shouldBackoff({ artworkRole, ownerId, ownerType }) {
    const failureState = await getFailureState({ artworkRole, ownerId, ownerType });
    if (!failureState?.nextRetryAt) {
      return {
        active: false,
        failure: failureState,
        retryAfterAt: null,
      };
    }

    const nextRetryAtMs = Date.parse(failureState.nextRetryAt);
    if (!Number.isFinite(nextRetryAtMs) || nextRetryAtMs <= nowFn()) {
      return {
        active: false,
        failure: failureState,
        retryAfterAt: failureState.nextRetryAt,
      };
    }

    return {
      active: true,
      failure: failureState,
      retryAfterAt: failureState.nextRetryAt,
    };
  }

  async function recordFailure({
    artworkRole,
    failureCode = 'artwork_unavailable',
    ownerId,
    ownerType,
  }) {
    const normalized = normalizeFailureKey({ artworkRole, ownerId, ownerType });
    const existing = await getArtworkFetchFailureFn(normalized);
    const failureCount = (existing?.failureCount ?? 0) + 1;
    const failedAtMs = nowFn();
    const nextRetryAtMs = failedAtMs + resolveBackoffDelayMs(failureCount, backoffScheduleMs);

    return upsertArtworkFetchFailureFn({
      ...normalized,
      failureCount,
      lastFailureCode: failureCode,
      lastFailedAt: new Date(failedAtMs).toISOString(),
      nextRetryAt: new Date(nextRetryAtMs).toISOString(),
    });
  }

  async function clearFailure({ artworkRole, ownerId, ownerType }) {
    const normalized = normalizeFailureKey({ artworkRole, ownerId, ownerType });
    return deleteArtworkFetchFailureFn(normalized);
  }

  return {
    clearFailure,
    getFailureState,
    recordFailure,
    shouldBackoff,
  };
}
