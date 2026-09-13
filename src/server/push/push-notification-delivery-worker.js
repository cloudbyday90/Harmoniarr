/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { PUSH_TRANSPORT_TIMEOUT_MS, PUSH_COMPLETION_RESERVE_MS } from './push-delivery-budget.js';

function hasClaimToken(notification) {
  return typeof notification.claimToken === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notification.claimToken);
}

/** One claimed delivery, with outcome accounting owned by the successful queue update. */
export function createPushNotificationDeliveryWorker({
  maxAttempts, nowFn, monotonicNowFn = () => performance.now(), pushNotificationDeliveryPolicyService, pushNotificationQueueStore,
  pushNotificationService, pushSubscriptionStore, retryBaseMs, stderr,
}) {
  function reportQueueFailure() {
    try {
      const result = stderr.write('[harmoniarr-push] Notification queue worker could not complete a queued delivery.\n');
      if (typeof result?.catch === 'function') result.catch(() => {});
    } catch { /* Diagnostic failures must not interrupt recipient processing. */ }
  }

  async function checkDeliveryPolicy(notification) {
    try {
      const decision = await pushNotificationDeliveryPolicyService.getDeliveryDecision({
        eventType: notification.eventType, userId: notification.userId,
      });
      if (typeof decision?.allowed === 'boolean' && typeof decision.retryable === 'boolean'
        && !(decision.allowed && decision.retryable)) return decision;
    } catch { /* An unavailable evaluator cannot authorize a network send. */ }
    return { allowed: false, retryable: true };
  }

  async function prepareDelivery(notification) {
    try {
      const subscription = notification.subscriptionId
        ? await pushSubscriptionStore.getSubscriptionById(notification.subscriptionId) : null;
      if (!subscription || subscription.id !== notification.subscriptionId || subscription.userId !== notification.userId) {
        return { result: { status: 'expired' } };
      }
      const decision = await checkDeliveryPolicy(notification);
      if (!decision.allowed) {
        return { result: decision.retryable ? { status: 'failed', retryable: true } : { status: 'expired' } };
      }
      return { subscription };
    } catch {
      reportQueueFailure();
      return { result: { status: 'failed' } };
    }
  }

  function getOutcome(result, notification) {
    if (result?.status === 'sent') return { counter: 'deliveredCount', sent: true };
    // "Expired" also includes permanent preference/account suppression.
    if (result?.status === 'expired') return { counter: 'expiredCount', state: { expired: true } };
    if (result?.retryable && notification.attempts < maxAttempts) {
      const now = nowFn();
      const multiplier = Math.max(1, 2 ** Math.max(0, Number(notification.attempts) || 0));
      const requestedRetry = result.retryAt ? new Date(result.retryAt) : new Date(now.getTime() + multiplier * retryBaseMs);
      const nextAttemptAt = Number.isNaN(requestedRetry.getTime()) ? now.toISOString() : requestedRetry.toISOString();
      return { counter: 'retriedCount', state: { nextAttemptAt } };
    }
    return { counter: 'failedCount', state: { failed: true } };
  }

  async function deliverNotification(notification) {
    if (!hasClaimToken(notification)) return 'claimLostCount';
    const prepared = await prepareDelivery(notification);
    let result = prepared.result;
    if (prepared.subscription) {
      // Use the database's current clock immediately before entering transport.
      // A read failure is infrastructure failure, not proof of a lost claim.
      let remainingMs;
      const preflightStarted = monotonicNowFn();
      try {
        remainingMs = await pushNotificationQueueStore.getNotificationClaimRemainingMs(notification.id, { claimToken: notification.claimToken });
      } catch {
        throw new Error('Notification queue claim could not be verified');
      }
      if (remainingMs === null) return 'claimLostCount';
      if (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs)) {
        throw new Error('Notification queue claim could not be verified');
      }
      const usableMs = remainingMs - Math.max(0, monotonicNowFn() - preflightStarted);
      if (usableMs < PUSH_TRANSPORT_TIMEOUT_MS + PUSH_COMPLETION_RESERVE_MS) {
        result = { status: 'failed', retryable: true };
      } else {
        try {
          result = await pushNotificationService.sendNotificationToSubscription({ payload: notification.payload,
            subscription: prepared.subscription, timeoutMs: PUSH_TRANSPORT_TIMEOUT_MS, ttl: notification.ttlSeconds, userId: notification.userId });
        } catch {
          reportQueueFailure();
          result = { status: 'failed' };
        }
      }
    }
    const outcome = getOutcome(result, notification);
    let persisted;
    try {
      persisted = outcome.sent
        ? await pushNotificationQueueStore.markNotificationSent(notification.id, { claimToken: notification.claimToken })
        : await pushNotificationQueueStore.markNotificationFailed(notification.id, { ...outcome.state, claimToken: notification.claimToken });
    } catch {
      // Never follow an ambiguous completion failure with a second status write.
      throw new Error('Notification queue completion could not be persisted');
    }
    return persisted === true ? outcome.counter : 'claimLostCount';
  }
  return { deliverNotification };
}
