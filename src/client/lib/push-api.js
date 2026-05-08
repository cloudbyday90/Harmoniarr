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

import { apiRequest } from './api.js';

/**
 * Fetch the server's VAPID public key for push subscription.
 *
 * This endpoint is public (no session required).
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ ok: boolean, vapidPublicKey: string }>}
 */
export function fetchVapidPublicKey({ signal } = {}) {
  return apiRequest('/api/v1/push/vapid-public-key', { signal });
}

/**
 * Register a push subscription with the server.
 *
 * Requires an active session. `keys` must include `p256dh` and `auth` from
 * the PushSubscription returned by the browser.
 *
 * @param {object} params
 * @param {string} params.endpoint - Push subscription endpoint URL.
 * @param {{ p256dh: string, auth: string }} params.keys - Subscription key pair.
 * @param {string} [params.userAgent] - Optional user-agent string for display.
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ ok: boolean, id: string }>}
 */
export function subscribeToPush({ endpoint, keys, userAgent, signal } = {}) {
  return apiRequest('/api/v1/push/subscribe', {
    body: { endpoint, keys, userAgent: userAgent ?? null },
    includeCsrf: true,
    method: 'POST',
    signal,
  });
}

/**
 * Remove a push subscription from the server.
 *
 * Requires an active session.
 *
 * @param {object} params
 * @param {string} params.endpoint - Push subscription endpoint URL to remove.
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ ok: boolean }>}
 */
export function unsubscribeFromPush({ endpoint, signal } = {}) {
  return apiRequest('/api/v1/push/subscribe', {
    body: { endpoint },
    includeCsrf: true,
    method: 'DELETE',
    signal,
  });
}
