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

import { createPushNotificationQueueStore } from './push-notification-queue-store.js';
import { createPushNotificationService, DEFAULT_TTL_SECONDS } from './push-notification-service.js';
import { createPushSubscriptionStore } from './push-subscription-store.js';
import { createPushNotificationDeliveryPolicyService } from './push-notification-delivery-policy-service.js';
import { createPushNotificationDeliveryWorker } from './push-notification-delivery-worker.js';
import { validateQueueTtlSeconds } from './push-queue-ttl-policy.js';

import { PUSH_CLAIM_WINDOW_MS, PUSH_DELIVERY_BATCH_LIMIT, PUSH_TRANSPORT_TIMEOUT_MS, PUSH_COMPLETION_RESERVE_MS } from './push-delivery-budget.js';
const DEFAULT_COALESCE_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 30000;

export function createPushNotificationDispatchService({
  claimWindowMs = PUSH_CLAIM_WINDOW_MS,
  coalesceWindowMs = DEFAULT_COALESCE_WINDOW_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  nowFn = () => new Date(),
  monotonicNowFn = () => performance.now(),
  pushNotificationDeliveryPolicyService = createPushNotificationDeliveryPolicyService(),
  pushNotificationQueueStore = createPushNotificationQueueStore(),
  pushNotificationService = createPushNotificationService(),
  pushSubscriptionStore = createPushSubscriptionStore(),
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  stderr = process.stderr,
} = {}) {
  if (!Number.isSafeInteger(claimWindowMs) || claimWindowMs <= PUSH_TRANSPORT_TIMEOUT_MS + PUSH_COMPLETION_RESERVE_MS) {
    throw new RangeError('Push claim window must exceed the transport and completion budget');
  }
  const deliveryWorker = createPushNotificationDeliveryWorker({ maxAttempts, nowFn, monotonicNowFn, pushNotificationDeliveryPolicyService,
    pushNotificationQueueStore, pushNotificationService, pushSubscriptionStore, retryBaseMs, stderr });

  async function sendNotificationToUser({
    coalesceKey = null,
    eventType = 'generic',
    payload,
    ttl = DEFAULT_TTL_SECONDS,
    userId,
  }) {
    const ttlSeconds = validateQueueTtlSeconds(ttl);
    const subscriptions = await pushSubscriptionStore.listSubscriptionsForUser(userId);

    if (!Array.isArray(subscriptions) || subscriptions.length < 1) {
      return {
        failed: 0,
        queued: 0,
        removed: 0,
        sent: 0,
        updated: 0,
      };
    }

    if (typeof coalesceKey !== 'string' || coalesceKey.trim().length < 1) {
      await Promise.all(subscriptions.map((subscription) =>
        pushNotificationQueueStore.enqueueNotification({
          coalesceKey: null,
          eventType,
          payload,
          subscriptionId: subscription.id,
          ttlSeconds,
          userId,
        })
      ));

      return {
        failed: 0,
        queued: subscriptions.length,
        removed: 0,
        sent: 0,
        updated: 0,
      };
    }

    const since = new Date(nowFn().getTime() - coalesceWindowMs).toISOString();
    const pendingRows = await pushNotificationQueueStore.listPendingNotificationsForCoalesce({
      coalesceKey,
      eventType,
      since,
      userId,
    });

    const pendingRowsBySubscriptionId = new Map();
    for (const row of pendingRows) {
      if (!row.subscriptionId) {
        continue;
      }

      const rows = pendingRowsBySubscriptionId.get(row.subscriptionId) ?? [];
      rows.push(row);
      pendingRowsBySubscriptionId.set(row.subscriptionId, rows);
    }

    const idsToUpdate = [];
    const subscriptionsToEnqueue = [];

    for (const subscription of subscriptions) {
      const rows = pendingRowsBySubscriptionId.get(subscription.id) ?? [];
      if (rows.length > 0) {
        idsToUpdate.push(...rows.map((row) => row.id));
        continue;
      }

      subscriptionsToEnqueue.push(subscription);
    }

    let updatedRows = [];
    if (idsToUpdate.length > 0) {
      updatedRows = await pushNotificationQueueStore.updatePendingNotificationPayload({
        ids: idsToUpdate,
        payload,
        ttlSeconds,
      });
    }
    const expectedIds = new Set(idsToUpdate);
    const updatedIds = new Set((Array.isArray(updatedRows) ? updatedRows : [])
      .filter((row) => expectedIds.has(row.id)).map((row) => row.id));
    for (const subscription of subscriptions) {
      const observedRows = pendingRowsBySubscriptionId.get(subscription.id) ?? [];
      if (observedRows.some((row) => !updatedIds.has(row.id))) {
        // A claim can win between the lookup and conditional UPDATE. Retain
        // the producer's newer payload in independent pending work.
        subscriptionsToEnqueue.push(subscription);
      }
    }

    if (subscriptionsToEnqueue.length > 0) {
      await Promise.all(subscriptionsToEnqueue.map((subscription) =>
        pushNotificationQueueStore.enqueueNotification({
          coalesceKey,
          eventType,
          payload,
          subscriptionId: subscription.id,
          ttlSeconds,
          userId,
        })
      ));
    }

    return {
      failed: 0,
      queued: subscriptionsToEnqueue.length,
      removed: 0,
      sent: 0,
      updated: updatedIds.size,
    };
  }

  async function deliverPendingNotifications({ limit = PUSH_DELIVERY_BATCH_LIMIT } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PUSH_DELIVERY_BATCH_LIMIT) {
      throw new RangeError('Push delivery limit must be an integer between 1 and 50');
    }
    const summary = { claimedCount: 0, claimLostCount: 0, deliveredCount: 0,
      expiredCount: 0, failedCount: 0, retriedCount: 0 };
    for (let index = 0; index < limit; index += 1) {
      const rows = await pushNotificationQueueStore.claimPendingNotifications({ claimWindowMs, limit: 1 });
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('Push queue returned an invalid claim batch');
      if (rows.length === 0) break;
      summary.claimedCount += 1;
      summary[await deliveryWorker.deliverNotification(rows[0])] += 1;
    }
    return summary;
  }

  return {
    deliverPendingNotifications,
    sendNotificationToUser,
  };
}
