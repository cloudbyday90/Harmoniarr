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

import { createApiError } from './auth.js';
import { recordAuditEvent } from './audit.js';
import { operationRunRegistry } from '../shared/operation-run-descriptors.js';

export function createOperatorNotificationFanoutService({
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  dispatchNotificationBatch = async ({ notifications }) => ({
    attemptedCount: notifications.length,
    deliveredCount: notifications.length,
  }),
  getActiveRun = async () => null,
  listRecentRuns = async () => [],
  getOperatorNotifications = async () => ({ notifications: [] }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorNotificationFanout;
  let previousActionableKeys = new Set();
  let previousActionableKeysLoaded = false;

  function normalizeActionableNotifications(payload) {
    return (payload.notifications ?? []).filter((notification) => notification.requiresAction);
  }

  function buildActionableKeySet(notifications) {
    return new Set(notifications.map((notification) => notification.dedupeKey).filter(Boolean));
  }

  function diffNewActionableKeys(currentKeys) {
    return [...currentKeys].filter((key) => !previousActionableKeys.has(key));
  }

  async function ensurePreviousActionableKeysLoaded() {
    if (previousActionableKeysLoaded) {
      return;
    }

    const recentRuns = await listRecentRuns({ limit: 10 });
    const persistedRun = recentRuns.find((run) => (
      run?.summary?.triggerSource === 'automatic'
      && Array.isArray(run.summary.notificationDedupeKeys)
    ));

    previousActionableKeys = persistedRun
      ? new Set(persistedRun.summary.notificationDedupeKeys.filter(Boolean))
      : new Set();
    previousActionableKeysLoaded = true;
  }

  async function startOperatorNotificationFanoutRun({ requestMetadata = null, summary = {}, triggeredByUserId = null } = {}) {
    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'operator_notification_fanout_in_progress', 'An operator notification fan-out run is already running or queued');
    }

    const run = await createOperationRun({
      status: 'pending',
      summary,
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        runId: run.id,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Operator notification fan-out started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  async function startOperatorNotificationFanoutRunIfNeeded({ limit = 50 } = {}) {
    await ensurePreviousActionableKeysLoaded();

    const activeRun = await getActiveRun();
    if (activeRun) {
      return {
        accepted: false,
        reason: 'fanout_in_progress',
      };
    }

    const payload = await getOperatorNotifications({ limit });
    const actionableNotifications = normalizeActionableNotifications(payload);
    const currentActionableKeys = buildActionableKeySet(actionableNotifications);
    const newActionableKeys = diffNewActionableKeys(currentActionableKeys);
    previousActionableKeys = currentActionableKeys;

    if (newActionableKeys.length === 0) {
      return {
        accepted: false,
        reason: actionableNotifications.length > 0 ? 'no_new_actionable_notifications' : 'no_actionable_notifications',
      };
    }

    return startOperatorNotificationFanoutRun({
      summary: {
        actionableNotificationCount: newActionableKeys.length,
        notificationDedupeKeys: newActionableKeys,
        triggerSource: 'automatic',
      },
      triggeredByUserId: null,
    });
  }

  async function fanOutOperatorNotifications({ limit = 50, notificationDedupeKeys = null } = {}) {
    const payload = await getOperatorNotifications({ limit });
    const allowedKeys = Array.isArray(notificationDedupeKeys) && notificationDedupeKeys.length > 0
      ? new Set(notificationDedupeKeys)
      : null;
    const actionableNotifications = normalizeActionableNotifications(payload)
      .filter((notification) => !allowedKeys || allowedKeys.has(notification.dedupeKey));
    const dispatchResult = await dispatchNotificationBatch({
      notifications: actionableNotifications,
    });

    return {
      actionableCount: actionableNotifications.length,
      attemptedCount: dispatchResult.attemptedCount ?? actionableNotifications.length,
      deliveredCount: dispatchResult.deliveredCount ?? 0,
      notificationCount: payload.counts?.total ?? payload.notifications?.length ?? 0,
    };
  }

  return {
    fanOutOperatorNotifications,
    startOperatorNotificationFanoutRun,
    startOperatorNotificationFanoutRunIfNeeded,
  };
}
