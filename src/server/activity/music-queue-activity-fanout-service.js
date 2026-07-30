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

function normalizeWantedReleaseIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim()))];
}

export function resolveMusicQueueWantedReleaseIds(value) {
  const musicQueueContext = value?.musicQueueContext
    ?? value?.normalizedPayload?.musicQueue
    ?? value?.normalized_payload?.musicQueue
    ?? value
    ?? {};
  const wantedReleaseIds = normalizeWantedReleaseIds(musicQueueContext?.wantedReleaseIds);
  const wantedReleaseId = typeof musicQueueContext?.wantedReleaseId === 'string'
    && musicQueueContext.wantedReleaseId.trim()
    ? musicQueueContext.wantedReleaseId.trim()
    : null;

  if (wantedReleaseId && !wantedReleaseIds.includes(wantedReleaseId)) {
    wantedReleaseIds.unshift(wantedReleaseId);
  }

  return wantedReleaseIds;
}

export function addMusicQueueActivityFanoutScope(event, { wantedReleaseIds = [] } = {}) {
  if (!event || typeof event !== 'object') {
    return event;
  }

  const resolvedWantedReleaseIds = normalizeWantedReleaseIds(wantedReleaseIds);
  if (resolvedWantedReleaseIds.length < 2) {
    return event;
  }

  return {
    ...event,
    extraPayload: {
      ...(event.extraPayload ?? {}),
      wantedReleaseIds: resolvedWantedReleaseIds,
    },
  };
}

/**
 * Expands one provider lifecycle result into one release-scoped household
 * history row per active operator link. The payload intentionally carries no
 * provider diagnostics or per-operator quality preferences.
 */
export function fanOutMusicQueueActivityEvent(event) {
  if (!event || typeof event !== 'object') {
    return [];
  }

  const wantedReleaseIds = resolveMusicQueueWantedReleaseIds(event.extraPayload);
  if (wantedReleaseIds.length < 2) {
    return [event];
  }

  return wantedReleaseIds.map((wantedReleaseId) => {
    const { wantedReleaseIds: _fanoutScope, ...safePayload } = event.extraPayload ?? {};
    const route = safePayload.route?.name === 'music-queue-release'
      ? {
          ...safePayload.route,
          params: { wantedReleaseId },
        }
      : safePayload.route ?? null;

    return {
      ...event,
      entityId: wantedReleaseId,
      entityType: 'wanted_release',
      extraPayload: {
        ...safePayload,
        ...(route ? { route } : {}),
        wantedReleaseId,
      },
    };
  });
}
