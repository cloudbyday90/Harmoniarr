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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerPushRoutes } from '../../src/server/routes/push-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

const TEST_VAPID_PUBLIC_KEY = 'BNcR-test-vapid-public-key';
const TEST_SESSION = { appUserId: 'user-abc', csrfToken: 'test-csrf' };

function createPushRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerPushRoutes(app, {
      getVapidPublicKey: () => TEST_VAPID_PUBLIC_KEY,
      subscribe: async ({ userId, endpoint, p256dh, auth, userAgent }) => ({
        id: 'sub-1',
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent,
        createdAt: '2026-06-02T00:00:00.000Z',
      }),
      unsubscribe: async () => {},
      requireSession: async () => TEST_SESSION,
      ...overrides,
    });
  });
}

// ── GET /api/v1/push/vapid-public-key ─────────────────────────────────────────

test('vapid-public-key route: returns the VAPID public key without authentication', async () => {
  const requireSession = async () => { throw createApiError(401, 'auth_required', 'Not authed'); };
  const app = createPushRouteTestApp({ requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/vapid-public-key`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.vapidPublicKey, TEST_VAPID_PUBLIC_KEY);
  });
});

test('vapid-public-key route: calls getVapidPublicKey', async (t) => {
  const getVapidPublicKey = t.mock.fn(() => TEST_VAPID_PUBLIC_KEY);
  const app = createPushRouteTestApp({ getVapidPublicKey });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/push/vapid-public-key`);
    assert.equal(getVapidPublicKey.mock.callCount(), 1);
  });
});

// ── POST /api/v1/push/subscribe ───────────────────────────────────────────────

test('subscribe route: 201 and subscription id on valid input', async (t) => {
  const subscribe = t.mock.fn(async () => ({
    id: 'sub-abc',
    userId: TEST_SESSION.appUserId,
    endpoint: 'https://push.example.com/sub',
    p256dh: 'p256dh-value',
    auth: 'auth-value',
    userAgent: null,
    createdAt: '2026-06-02T00:00:00.000Z',
  }));
  const app = createPushRouteTestApp({ subscribe });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.ok, true);
    assert.equal(payload.id, 'sub-abc');
    assert.equal(subscribe.mock.callCount(), 1);
  });
});

test('subscribe route: passes userId from session to subscribe', async (t) => {
  const subscribe = t.mock.fn(async ({ userId }) => ({
    id: 'x',
    userId,
    endpoint: 'e',
    p256dh: 'p',
    auth: 'a',
    userAgent: null,
    createdAt: '',
  }));
  const app = createPushRouteTestApp({ subscribe });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
      }),
    });

    const args = subscribe.mock.calls[0].arguments[0];
    assert.equal(args.userId, TEST_SESSION.appUserId);
  });
});

test('subscribe route: 400 when endpoint is missing', async () => {
  const app = createPushRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: { p256dh: 'p', auth: 'a' } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'push_subscription_invalid');
  });
});

test('subscribe route: 400 when p256dh is missing', async () => {
  const app = createPushRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub',
        keys: { auth: 'auth-value' },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'push_subscription_invalid');
  });
});

test('subscribe route: 400 when auth is missing', async () => {
  const app = createPushRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'p256dh-value' },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'push_subscription_invalid');
  });
});

test('subscribe route: 401 when session is not authenticated', async () => {
  const app = createPushRouteTestApp({
    requireSession: async () => { throw createApiError(401, 'auth_required', 'Authentication required'); },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/sub',
        keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
      }),
    });

    assert.equal(response.status, 401);
  });
});

// ── DELETE /api/v1/push/subscribe ─────────────────────────────────────────────

test('unsubscribe route: 200 on valid endpoint', async (t) => {
  const unsubscribe = t.mock.fn(async () => {});
  const app = createPushRouteTestApp({ unsubscribe });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example.com/sub' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(unsubscribe.mock.callCount(), 1);
    const [userId, endpoint] = unsubscribe.mock.calls[0].arguments;
    assert.equal(userId, TEST_SESSION.appUserId);
    assert.equal(endpoint, 'https://push.example.com/sub');
  });
});

test('unsubscribe route: 400 when endpoint is missing', async () => {
  const app = createPushRouteTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'push_subscription_invalid');
  });
});

test('unsubscribe route: 401 when session is not authenticated', async () => {
  const app = createPushRouteTestApp({
    requireSession: async () => { throw createApiError(401, 'auth_required', 'Authentication required'); },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example.com/sub' }),
    });

    assert.equal(response.status, 401);
  });
});
