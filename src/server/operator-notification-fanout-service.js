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
  getOperatorNotifications = async () => ({ notifications: [] }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorNotificationFanout;

  async function startOperatorNotificationFanoutRun({ requestMetadata = null, triggeredByUserId = null } = {}) {
    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'operator_notification_fanout_in_progress', 'An operator notification fan-out run is already running or queued');
    }

    const run = await createOperationRun({
      status: 'pending',
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

  async function fanOutOperatorNotifications({ limit = 50 } = {}) {
    const payload = await getOperatorNotifications({ limit });
    const actionableNotifications = (payload.notifications ?? []).filter((notification) => notification.requiresAction);
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
  };
}
