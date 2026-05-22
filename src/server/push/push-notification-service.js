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
import { createPushSubscriptionStore } from './push-subscription-store.js';
import { resolveOrGenerateVapidKeys } from './vapid-keys.js';

/**
 * Default TTL for push messages in seconds (24 hours).
 * Push services may deliver within this window even if the device is offline.
 */
const DEFAULT_TTL_SECONDS = 86400;

/**
 * HTTP status codes returned by push services that signal an expired or
 * invalid subscription. On receiving these the subscription should be removed.
 */
const EXPIRED_SUBSCRIPTION_STATUSES = new Set([404, 410]);
const INVALID_SUBSCRIPTION_STATUSES = new Set([404, 410, 412]);
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
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  const seconds = Number.parseInt(trimmed, 10);
  if (Number.isInteger(seconds) && seconds >= 0) {
    return new Date(now.getTime() + (seconds * 1000)).toISOString();
  }

  const retryAt = new Date(trimmed);
  return Number.isNaN(retryAt.getTime()) ? null : retryAt.toISOString();
}

/**
 * Builds the `PushSubscription`-shaped object that `web-push.sendNotification`
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
  pushSubscriptionStore = createPushSubscriptionStore(),
  vapidKeys = resolveOrGenerateVapidKeys(),
  vapidContact = process.env.VAPID_CONTACT ?? 'mailto:admin@harmoniarr.local',
  webPushLib = webPush,
  stderr = process.stderr,
} = {}) {
  // Configure VAPID details once at construction time.
  webPushLib.setVapidDetails(vapidContact, vapidKeys.publicKey, vapidKeys.privateKey);

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
   * @param {string|null} [params.userId]
   * @returns {Promise<object>}
   */
  async function sendNotificationToSubscription({ subscription, payload, ttl = DEFAULT_TTL_SECONDS, userId = null }) {
    try {
      await webPushLib.sendNotification(
        buildWebPushSubscription(subscription),
        serialisePayload(payload),
        { TTL: ttl },
      );
      return {
        status: 'sent',
      };
    } catch (error) {
      const statusCode = error?.statusCode ?? error?.status ?? null;

      if (INVALID_SUBSCRIPTION_STATUSES.has(statusCode)) {
        pushSubscriptionStore.deleteSubscriptionByEndpoint(subscription.endpoint).catch((deleteError) => {
          stderr.write(
            `[harmoniarr-push] Failed to remove expired subscription endpoint=${subscription.endpoint}: ${deleteError?.message}\n`,
          );
        });
        return {
          retryAt: null,
          retryable: false,
          status: 'expired',
          statusCode,
        };
      }

      const headers = normalizeHeaders(error?.headers);
      stderr.write(
        `[harmoniarr-push] Push delivery failed for userId=${userId ?? subscription.userId ?? 'unknown'} endpoint=${subscription.endpoint} status=${statusCode ?? 'unknown'}: ${error?.message}\n`,
      );
      return {
        retryAt: parseRetryAfterHeader(headers['retry-after']),
        retryable: statusCode == null || RETRYABLE_DELIVERY_STATUSES.has(statusCode),
        status: 'failed',
        statusCode,
      };
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
   * Delivery is best-effort: individual failures are caught and logged. Expired
   * subscriptions (HTTP 404/410) are removed automatically.
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
