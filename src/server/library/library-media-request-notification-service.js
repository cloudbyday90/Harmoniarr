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

function toSortableTime(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeLimit(limit, { defaultLimit = 6, maximum = 20 } = {}) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maximum);
}

function buildRequestSubject(request) {
  if (request?.requestKind === 'external_url') {
    return request.sourceUrl ?? 'an external music request';
  }

  if (request?.requestKind === 'track') {
    const parts = [request.artistName, request.trackTitle].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'a track request';
  }

  const parts = [request?.artistName, request?.releaseTitle].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'a release request';
}

function buildDelegatedRequestNotification(request) {
  if (!request?.requestedByUser?.id || !request?.requestedForUser?.id) {
    return null;
  }

  if (request.requestedByUser.id === request.requestedForUser.id) {
    return null;
  }

  return {
    category: 'delegated_request',
    dedupeKey: `media-request:${request.id}:delegated`,
    message: `${request.requestedByUser.username ?? 'An administrator'} requested ${buildRequestSubject(request)} for you.`,
    occurredAt: request.createdAt ?? request.updatedAt ?? null,
    reference: {
      mediaRequestId: request.id,
      type: 'media_request',
    },
    severity: 'info',
    title: 'Music requested for you',
  };
}

function buildFulfillmentNotification(request) {
  const fulfillmentStatus = request?.fulfillmentStatus;
  if (!fulfillmentStatus?.code) {
    return null;
  }

  switch (fulfillmentStatus.code) {
    case 'under_review':
      return {
        category: 'review',
        dedupeKey: `media-request:${request.id}:review`,
        message: `${buildRequestSubject(request)} is still under review before fulfillment can continue.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'info',
        title: 'Request under review',
      };
    case 'queued':
      return {
        category: 'fulfillment',
        dedupeKey: `media-request:${request.id}:queued`,
        message: `${buildRequestSubject(request)} has been queued for fulfillment.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'info',
        title: 'Request queued',
      };
    case 'downloading':
      return {
        category: 'fulfillment',
        dedupeKey: `media-request:${request.id}:downloading`,
        message: `${buildRequestSubject(request)} is downloading now.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'info',
        title: 'Download in progress',
      };
    case 'import_pending':
      return {
        category: 'fulfillment',
        dedupeKey: `media-request:${request.id}:import-pending`,
        message: `${buildRequestSubject(request)} has finished downloading and is waiting for import.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'info',
        title: 'Ready for import',
      };
    case 'fulfilled':
      return {
        category: 'fulfillment',
        dedupeKey: `media-request:${request.id}:fulfilled`,
        message: `${buildRequestSubject(request)} is now available in the library.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'success',
        title: 'Request fulfilled',
      };
    case 'already_available':
      return {
        category: 'fulfillment',
        dedupeKey: `media-request:${request.id}:already-available`,
        message: `${buildRequestSubject(request)} already matched media in the library.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'success',
        title: 'Already in your library',
      };
    case 'failed':
      return {
        category: 'failure',
        dedupeKey: `media-request:${request.id}:failed`,
        message: `${buildRequestSubject(request)} hit a fulfillment failure and needs operator attention.`,
        occurredAt: fulfillmentStatus.occurredAt ?? request.updatedAt ?? request.createdAt ?? null,
        reference: {
          mediaRequestId: request.id,
          type: 'media_request',
        },
        severity: 'error',
        title: 'Request needs attention',
      };
    default:
      return null;
  }
}

export function createLibraryMediaRequestNotificationService({
  nowFn = () => new Date(),
} = {}) {
  function buildNotifications({ limit, mediaRequests = [] } = {}) {
    const normalizedLimit = normalizeLimit(limit);
    const notifications = [];
    const dedupe = new Set();

    for (const request of mediaRequests) {
      for (const candidateNotification of [
        buildDelegatedRequestNotification(request),
        buildFulfillmentNotification(request),
      ]) {
        if (!candidateNotification || dedupe.has(candidateNotification.dedupeKey)) {
          continue;
        }

        dedupe.add(candidateNotification.dedupeKey);
        notifications.push({
          ...candidateNotification,
          id: candidateNotification.dedupeKey,
        });
      }
    }

    const sortedNotifications = notifications
      .sort((left, right) => toSortableTime(right.occurredAt) - toSortableTime(left.occurredAt))
      .slice(0, normalizedLimit);

    const counts = sortedNotifications.reduce((accumulator, notification) => {
      accumulator.total += 1;
      accumulator.byCategory[notification.category] = (accumulator.byCategory[notification.category] ?? 0) + 1;
      return accumulator;
    }, {
      byCategory: {
        delegated_request: 0,
        failure: 0,
        fulfillment: 0,
        review: 0,
      },
      total: 0,
    });

    return {
      checkedAt: nowFn().toISOString(),
      counts,
      notifications: sortedNotifications,
    };
  }

  return {
    buildNotifications,
  };
}
