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

const DEFAULT_CLAIM_WINDOW_MS = 60000;
const DEFAULT_COALESCE_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 30000;

function normalizeDate(value, fallbackNow) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallbackNow : parsed;
}

function computeRetryAt({ attempts, now, retryBaseMs }) {
  const multiplier = Math.max(1, 2 ** Math.max(0, Number(attempts) || 0));
  return new Date(now.getTime() + (multiplier * retryBaseMs)).toISOString();
}

export function createPushNotificationDispatchService({
  claimWindowMs = DEFAULT_CLAIM_WINDOW_MS,
  coalesceWindowMs = DEFAULT_COALESCE_WINDOW_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  nowFn = () => new Date(),
  pushNotificationQueueStore = createPushNotificationQueueStore(),
  pushNotificationService = createPushNotificationService(),
  pushSubscriptionStore = createPushSubscriptionStore(),
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  stderr = process.stderr,
} = {}) {
  async function sendNotificationToUser({
    coalesceKey = null,
    eventType = 'generic',
    payload,
    ttl = DEFAULT_TTL_SECONDS,
    userId,
  }) {
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

    const ttlSeconds = Math.max(1, Number.parseInt(String(ttl ?? DEFAULT_TTL_SECONDS), 10) || DEFAULT_TTL_SECONDS);

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

    if (idsToUpdate.length > 0) {
      await pushNotificationQueueStore.updatePendingNotificationPayload({
        ids: idsToUpdate,
        payload,
        ttlSeconds,
      });
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
      updated: idsToUpdate.length,
    };
  }

  async function deliverPendingNotifications({ limit = 50 } = {}) {
    const claimedNotifications = await pushNotificationQueueStore.claimPendingNotifications({
      claimWindowMs,
      limit,
    });

    if (!Array.isArray(claimedNotifications) || claimedNotifications.length < 1) {
      return {
        claimedCount: 0,
        deliveredCount: 0,
        expiredCount: 0,
        failedCount: 0,
        retriedCount: 0,
      };
    }

    let deliveredCount = 0;
    let expiredCount = 0;
    let failedCount = 0;
    let retriedCount = 0;

    for (const notification of claimedNotifications) {
      try {
        const subscription = notification.subscriptionId
          ? await pushSubscriptionStore.getSubscriptionById(notification.subscriptionId)
          : null;

        if (!subscription) {
          expiredCount += 1;
          await pushNotificationQueueStore.markNotificationFailed(notification.id, { expired: true });
          continue;
        }

        const result = await pushNotificationService.sendNotificationToSubscription({
          payload: notification.payload,
          subscription,
          ttl: notification.ttlSeconds,
          userId: notification.userId,
        });

        if (result.status === 'sent') {
          deliveredCount += 1;
          await pushNotificationQueueStore.markNotificationSent(notification.id);
          continue;
        }

        if (result.status === 'expired') {
          expiredCount += 1;
          await pushNotificationQueueStore.markNotificationFailed(notification.id, { expired: true });
          continue;
        }

        if (result.retryable && notification.attempts < maxAttempts) {
          retriedCount += 1;
          const now = nowFn();
          const retryAt = result.retryAt
            ? normalizeDate(result.retryAt, now).toISOString()
            : computeRetryAt({ attempts: notification.attempts, now, retryBaseMs });
          await pushNotificationQueueStore.markNotificationFailed(notification.id, { nextAttemptAt: retryAt });
          continue;
        }

        failedCount += 1;
        await pushNotificationQueueStore.markNotificationFailed(notification.id, { failed: true });
      } catch (error) {
        failedCount += 1;
        stderr.write(`[harmoniarr-push] Notification queue worker failed for id=${notification.id}: ${error?.message ?? error}\n`);
        await pushNotificationQueueStore.markNotificationFailed(notification.id, { failed: true });
      }
    }

    return {
      claimedCount: claimedNotifications.length,
      deliveredCount,
      expiredCount,
      failedCount,
      retriedCount,
    };
  }

  return {
    deliverPendingNotifications,
    sendNotificationToUser,
  };
}
