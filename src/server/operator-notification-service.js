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

import { getOperationRunDescriptorDefinition } from '../shared/operation-run-descriptors.js';

function toSortableTime(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeLimit(limit, { defaultLimit = 20, maximum = 50 } = {}) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maximum);
}

function buildOperationRunTitle(operationType) {
  return getOperationRunDescriptorDefinition(operationType)?.title ?? operationType;
}

function buildOperationRunNotification(run) {
  const title = buildOperationRunTitle(run.operationType);

  if (run.status === 'failed' || run.status === 'cancelled') {
    return {
      category: 'failure',
      dedupeKey: `run:${run.id}:failure`,
      message: run.errorMessage ?? `${title} requires operator review.`,
      reference: {
        operationType: run.operationType,
        runId: run.id,
        type: 'operation_run',
      },
      requiresAction: true,
      severity: 'error',
      title: `${title} failed`,
    };
  }

  if (run.status === 'pending') {
    return {
      category: 'queued_work',
      dedupeKey: `run:${run.id}:queued`,
      message: `${title} is queued and waiting for a worker slot.`,
      reference: {
        operationType: run.operationType,
        runId: run.id,
        type: 'operation_run',
      },
      requiresAction: false,
      severity: 'info',
      title: `${title} queued`,
    };
  }

  if (run.status === 'completed' && Number.isInteger(run.attemptCount) && run.attemptCount > 1) {
    return {
      category: 'recovery',
      dedupeKey: `run:${run.id}:recovered`,
      message: `${title} completed after retry attempts.`,
      reference: {
        operationType: run.operationType,
        runId: run.id,
        type: 'operation_run',
      },
      requiresAction: false,
      severity: 'success',
      title: `${title} recovered`,
    };
  }

  return null;
}

function buildHeartbeatNotification(heartbeat) {
  if (!heartbeat || !heartbeat.key) {
    return null;
  }

  if (heartbeat.status !== 'paused' && heartbeat.status !== 'error') {
    return null;
  }

  return {
    category: 'manual_intervention',
    dedupeKey: `heartbeat:${heartbeat.key}:${heartbeat.status}`,
    message: heartbeat.message,
    reference: {
      key: heartbeat.key,
      type: 'heartbeat',
    },
    requiresAction: true,
    severity: 'warning',
    title: `${heartbeat.label} needs intervention`,
  };
}

export function createOperatorNotificationService({
  nowFn = () => new Date(),
} = {}) {
  function buildOperatorNotifications({
    acknowledgedBefore = null,
    heartbeats = [],
    operationRuns = [],
    limit,
  } = {}) {
    const normalizedLimit = normalizeLimit(limit);
    const notifications = [];
    const dedupe = new Set();

    for (const run of operationRuns) {
      const notification = buildOperationRunNotification(run);
      if (!notification || dedupe.has(notification.dedupeKey)) {
        continue;
      }

      dedupe.add(notification.dedupeKey);
      const occurredAt = run.finishedAt ?? run.cancelledAt ?? run.startedAt ?? null;
      notifications.push({
        ...notification,
        id: notification.dedupeKey,
        isAcknowledged: acknowledgedBefore && occurredAt ? occurredAt <= acknowledgedBefore : false,
        occurredAt,
      });
    }

    for (const heartbeat of heartbeats) {
      const notification = buildHeartbeatNotification(heartbeat);
      if (!notification || dedupe.has(notification.dedupeKey)) {
        continue;
      }

      dedupe.add(notification.dedupeKey);
      const occurredAt = heartbeat.lastTickAt ?? null;
      notifications.push({
        ...notification,
        id: notification.dedupeKey,
        isAcknowledged: acknowledgedBefore && occurredAt ? occurredAt <= acknowledgedBefore : false,
        occurredAt,
      });
    }

    const sortedNotifications = notifications
      .sort((left, right) => toSortableTime(right.occurredAt) - toSortableTime(left.occurredAt))
      .slice(0, normalizedLimit);

    const counts = sortedNotifications.reduce((accumulator, notification) => {
      accumulator.total += 1;
      if (notification.requiresAction) {
        accumulator.actionable += 1;
      }
      if (!notification.isAcknowledged) {
        accumulator.unacknowledged += 1;
      }

      accumulator.byCategory[notification.category] = (accumulator.byCategory[notification.category] ?? 0) + 1;
      return accumulator;
    }, {
      actionable: 0,
      byCategory: {
        failure: 0,
        manual_intervention: 0,
        queued_work: 0,
        recovery: 0,
      },
      total: 0,
      unacknowledged: 0,
    });

    return {
      checkedAt: nowFn().toISOString(),
      counts,
      notifications: sortedNotifications,
    };
  }

  return {
    buildOperatorNotifications,
  };
}