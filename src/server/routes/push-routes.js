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

import { createApiError } from '../auth.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

/**
 * Validates that a push subscription payload has the required fields.
 * Returns a normalised object or throws a 400 API error.
 *
 * @param {unknown} body
 * @returns {{ endpoint: string, p256dh: string, auth: string }}
 */
function validateSubscriptionBody(body) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';

  if (!endpoint) {
    throw createApiError(400, 'push_subscription_invalid', 'endpoint is required');
  }

  if (!p256dh) {
    throw createApiError(400, 'push_subscription_invalid', 'keys.p256dh is required');
  }

  if (!auth) {
    throw createApiError(400, 'push_subscription_invalid', 'keys.auth is required');
  }

  return { endpoint, p256dh, auth };
}

/**
 * Registers the Web Push subscription management routes.
 *
 * @param {import('express').Application} app
 * @param {object} deps
 * @param {function} deps.getVapidPublicKey
 * @param {function} deps.subscribe
 * @param {function} deps.unsubscribe
 * @param {function} [deps.requireSession]
 */
export function registerPushRoutes(app, {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  limitPushSubscriptionMutation = skipRateLimitMiddleware,
  requireSession = defaultRequestAuthDependencies.requireSession,
}) {
  /**
   * GET /api/v1/push/vapid-public-key
   *
   * Returns the VAPID application server public key. The client passes this as
   * `applicationServerKey` when calling `pushManager.subscribe()` so the push
   * service can verify that messages are sent by this server.
   *
   * Public — does not require authentication. The key is not secret.
   */
  app.get('/api/v1/push/vapid-public-key', asyncRoute(async (_request, response) => {
    response.json({ ok: true, vapidPublicKey: getVapidPublicKey() });
  }));

  /**
   * POST /api/v1/push/subscribe
   *
   * Registers or refreshes a push subscription for the authenticated user.
   *
   * Body (mirrors the browser `PushSubscription.toJSON()` shape):
   * ```json
   * {
   *   "endpoint": "https://push.googleapis.com/...",
   *   "keys": { "p256dh": "...", "auth": "..." }
   * }
   * ```
   */
  app.post('/api/v1/push/subscribe', limitPushSubscriptionMutation, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const { endpoint, p256dh, auth } = validateSubscriptionBody(request.body);
    const userAgent = typeof request.headers['user-agent'] === 'string'
      ? request.headers['user-agent'].slice(0, 500)
      : null;

    const subscription = await subscribe({
      userId: session.appUserId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    });

    response.status(201).json({ ok: true, id: subscription.id });
  }));

  /**
   * DELETE /api/v1/push/subscribe
   *
   * Removes a push subscription for the authenticated user.
   *
   * Body:
   * ```json
   * { "endpoint": "https://push.googleapis.com/..." }
   * ```
   */
  app.delete('/api/v1/push/subscribe', limitPushSubscriptionMutation, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const endpoint = typeof request.body?.endpoint === 'string'
      ? request.body.endpoint.trim()
      : '';

    if (!endpoint) {
      throw createApiError(400, 'push_subscription_invalid', 'endpoint is required');
    }

    await unsubscribe(session.appUserId, endpoint);
    response.json({ ok: true });
  }));
}
