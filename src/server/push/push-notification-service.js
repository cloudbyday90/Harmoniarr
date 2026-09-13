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

import webPush from 'web-push';
import { performance } from 'node:perf_hooks';
import { createPushSubscriptionStore } from './push-subscription-store.js';
import { resolveOrGenerateVapidKeys, resolveVapidContactFromEnv } from './vapid-keys.js';
import { createPushHttpTransport, createPushTransportError } from './push-http-transport.js';
import { PUSH_TRANSPORT_TIMEOUT_MS } from './push-delivery-budget.js';

/**
 * Default TTL for push messages in seconds (24 hours).
 * Push services may deliver within this window even if the device is offline.
 */
const DEFAULT_TTL_SECONDS = 86400;

/**
 * HTTP status codes returned by push services that signal an expired or
 * invalid subscription. Only the unchanged original registration can be invalidated.
 */
const EXPIRED_SUBSCRIPTION_STATUSES = new Set([404, 410]);
const RETRYABLE_DELIVERY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  );
}

function parseRetryAfterHeader(value, now = new Date()) {
  if (typeof value !== 'string' || value.length > 256 || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    const next = new Date(now.getTime() + seconds * 1000);
    return Number.isSafeInteger(seconds) && Number.isFinite(next.getTime()) ? next.toISOString() : null;
  }
  // HTTP-date permits IMF-fixdate and the two obsolete HTTP date forms.
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?(?:,| )/.test(trimmed)
    && !/^(?:Tuesday|Wednesday|Thursday|Saturday),/.test(trimmed)) return null;
  const retryAt = new Date(trimmed);
  return Number.isFinite(retryAt.getTime()) && retryAt.getTime() > now.getTime() ? retryAt.toISOString() : null;
}

/**
 * Builds the `PushSubscription`-shaped object that `web-push.generateRequestDetails`
 * expects from a stored subscription row.
 *
 * @param {object} subscription - Row from `push-subscription-store`.
 * @returns {object}
 */
function buildWebPushSubscription(subscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

/**
 * Serialises a notification payload to JSON for transmission.
 *
 * @param {object} payload
 * @returns {string}
 */
function serialisePayload(payload) {
  return JSON.stringify(payload);
}

/**
 * Push notification service. Handles subscription management and message
 * delivery via the Web Push Protocol (RFC 8030) with VAPID authentication.
 *
 * VAPID contact is a `mailto:` or `https:` URI identifying the server
 * operator, included in VAPID JWTs as required by the spec.
 *
 * @param {object} [options]
 * @param {object} [options.pushSubscriptionStore]
 * @param {{ publicKey: string, privateKey: string }} [options.vapidKeys]
 * @param {string} [options.vapidContact]
 * @param {object} [options.webPushLib] - Injectable for testing (defaults to the `web-push` module).
 * @param {object} [options.stderr]
 * @returns {{ getVapidPublicKey, subscribe, unsubscribe, sendNotificationToSubscription, sendNotificationToUser }}
 */
export function createPushNotificationService({
  nowFn = () => performance.now(),
  pushHttpTransport = createPushHttpTransport({ nowFn }),
  pushSubscriptionStore = createPushSubscriptionStore(),
  vapidKeys = resolveOrGenerateVapidKeys(),
  vapidContact = resolveVapidContactFromEnv(),
  webPushLib = webPush,
  stderr = process.stderr,
} = {}) {
  // Configure VAPID details once at construction time.
  webPushLib.setVapidDetails(vapidContact, vapidKeys.publicKey, vapidKeys.privateKey);

  function reportFailure(message) {
    try {
      const result = stderr.write(message);
      if (typeof result?.catch === 'function') result.catch(() => {});
    } catch { /* Diagnostics cannot affect delivery classification. */ }
  }

  function failedDelivery({ statusCode = null, headers = {} }, registration) {
    const validStatus = Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : null;
    if (EXPIRED_SUBSCRIPTION_STATUSES.has(validStatus)) {
      if (registration && Object.values(registration).every((value) => typeof value === 'string' && value.length > 0)) {
        // A false CAS result means this registration changed or already expired.
        // Cleanup stays outside the transport budget and never falls back to endpoint-only invalidation.
        Promise.resolve().then(() => pushSubscriptionStore.invalidateSubscriptionRegistration(registration)).catch(() => {
          reportFailure('[harmoniarr-push] Expired subscription invalidation failed.\n');
        });
      }
      return { retryAt: null, retryable: false, status: 'expired', statusCode: validStatus };
    }
    reportFailure('[harmoniarr-push] Push delivery failed.\n');
    return { retryAt: parseRetryAfterHeader(normalizeHeaders(headers)['retry-after']),
      retryable: validStatus == null || RETRYABLE_DELIVERY_STATUSES.has(validStatus), status: 'failed', statusCode: validStatus };
  }

  /**
   * Returns the VAPID public key so the client can subscribe using the same
   * application server key that this server uses to send.
   *
   * @returns {string}
   */
  function getVapidPublicKey() {
    return vapidKeys.publicKey;
  }

  /**
   * Sends a push notification to one active subscription.
   *
   * @param {object} params
   * @param {object} params.subscription
   * @param {object} params.payload
   * @param {number} [params.ttl]
   * @param {number} [params.timeoutMs] Whole-operation budget, capped at 15 seconds.
   * @returns {Promise<object>}
   */
  async function sendNotificationToSubscription({ subscription, payload, ttl = DEFAULT_TTL_SECONDS, timeoutMs = PUSH_TRANSPORT_TIMEOUT_MS }) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > PUSH_TRANSPORT_TIMEOUT_MS) {
      throw new RangeError('Push transport timeout must be greater than zero and at most 15000 milliseconds');
    }
    const deadlineAt = nowFn() + timeoutMs;
    let registration = null;
    try {
      // Capture primitive identity before preparation or I/O can mutate the caller's row.
      registration = Object.freeze({ id: subscription.id, userId: subscription.userId,
        endpoint: subscription.endpoint, registrationToken: subscription.registrationToken });
      const requestDetails = webPushLib.generateRequestDetails(
        buildWebPushSubscription({ endpoint: registration.endpoint, p256dh: subscription.p256dh, auth: subscription.auth }),
        serialisePayload(payload),
        { TTL: ttl, vapidDetails: { subject: vapidContact, publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey } },
      );
      if (nowFn() >= deadlineAt) throw createPushTransportError('timeout');
      const response = await pushHttpTransport.sendRequest({ requestDetails, deadlineAt });
      if (Number.isInteger(response?.statusCode) && response.statusCode >= 200 && response.statusCode < 300) return { status: 'sent' };
      return failedDelivery(response ?? {}, registration);
    } catch (error) {
      return failedDelivery({ statusCode: error?.statusCode ?? error?.status, headers: error?.headers }, registration);
    }
  }

  /**
   * Registers or refreshes a push subscription for a user.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.endpoint
   * @param {string} params.p256dh
   * @param {string} params.auth
   * @param {string|null} [params.userAgent]
   * @returns {Promise<object>} The stored subscription row.
   */
  async function subscribe({ userId, endpoint, p256dh, auth, userAgent = null }) {
    return pushSubscriptionStore.upsertSubscription({ userId, endpoint, p256dh, auth, userAgent });
  }

  /**
   * Removes a specific subscription for a user.
   *
   * @param {string} userId
   * @param {string} endpoint
   * @returns {Promise<void>}
   */
  async function unsubscribe(userId, endpoint) {
    return pushSubscriptionStore.deleteSubscription(userId, endpoint);
  }

  /**
   * Sends a push notification to every active subscription for a user.
   *
   * Delivery is best-effort: individual failures are caught and logged. HTTP
   * 404/410 schedules conditional invalidation of the original registration.
   * The legacy `removed` counter counts expired attempts, not confirmed database mutations.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {object} params.payload - JSON-serialisable notification payload.
   * @param {number} [params.ttl] - Time-to-live in seconds (default: 24h).
   * @returns {Promise<{ sent: number, failed: number, removed: number }>}
   */
  async function sendNotificationToUser({ userId, payload, ttl = DEFAULT_TTL_SECONDS }) {
    const subscriptions = await pushSubscriptionStore.listSubscriptionsForUser(userId);

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      const result = await sendNotificationToSubscription({
        payload,
        subscription,
        ttl,
        userId,
      });

      if (result.status === 'sent') {
        sent++;
        continue;
      }

      if (result.status === 'expired') {
        removed++;
        continue;
      }

      failed++;
    }

    return { sent, failed, removed };
  }

  return {
    getVapidPublicKey,
    subscribe,
    unsubscribe,
    sendNotificationToSubscription,
    sendNotificationToUser,
  };
}

export {
  DEFAULT_TTL_SECONDS,
  EXPIRED_SUBSCRIPTION_STATUSES,
};
