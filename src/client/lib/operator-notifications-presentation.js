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

/**
 * Operator notifications presentation helpers.
 *
 * Pure, framework-free functions for operator notification display.
 * Extracted from component inline functions so they can be independently
 * tested and shared without Vue dependencies.
 */

/**
 * Return a CSS class for a notification severity code.
 *
 * @param {string|null|undefined} severity
 * @returns {string}
 */
export function getNotificationSeverityClass(severity) {
  switch (severity) {
    case 'error':
      return 'review-status-failed';
    case 'success':
      return 'review-status-selected';
    case 'warning':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

/**
 * Return a display label for a notification severity code.
 *
 * @param {string|null|undefined} severity
 * @returns {string}
 */
export function getNotificationSeverityLabel(severity) {
  switch (severity) {
    case 'error':
      return 'Failure';
    case 'success':
      return 'Recovered';
    case 'warning':
      return 'Needs review';
    default:
      return 'Queued';
  }
}

/**
 * Return a route link descriptor for a notification, or null if no link is
 * applicable.
 *
 * @param {object|null|undefined} notification
 * @returns {{ label: string, to: object }|null}
 */
export function buildNotificationLink(notification) {
  if (notification?.reference?.type === 'operation_run' && notification.reference.runId) {
    return {
      label: 'Open run detail',
      to: {
        hash: '#operation-run-detail-panel',
        name: 'activity-operations',
        query: {
          runId: notification.reference.runId,
        },
      },
    };
  }

  if (notification?.reference?.type === 'heartbeat') {
    return {
      label: 'Open dashboard',
      to: {
        hash: '#library-discovery-panel',
        name: 'dashboard-panel',
      },
    };
  }

  return null;
}

/**
 * Format a notification category token for display.
 *
 * Converts all underscore- or hyphen-separated parts to spaces so that raw
 * API values like 'manual_intervention' become 'manual intervention'. Returns
 * 'unknown' for absent values.
 *
 * @param {string|null|undefined} category
 * @returns {string}
 */
export function formatNotificationCategoryLabel(category) {
  return String(category || 'unknown').replaceAll(/[_-]+/g, ' ');
}
