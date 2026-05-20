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
import { registerActivityRoutes } from '../../src/server/routes/activity-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createActivityRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerActivityRoutes(app, {
      blockSourceUser: async () => ({ sourceUser: { username: 'peer-1' } }),
      buildActivityFeed: async () => ({
        checkedAt: '2026-06-01T12:00:00.000Z',
        events: [],
        total: 0,
      }),
      listBlockedSourceUsers: async () => ({
        blockedSourceUsers: [],
        checkedAt: '2026-06-01T12:00:00.000Z',
        query: null,
        total: 0,
      }),
      requireAdminSession: async () => ({ appUserId: 'admin-1' }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-token' }),
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      unblockSourceUser: async () => ({ sourceUser: { username: 'peer-1' } }),
      ...overrides,
    });
  });
}

test('activity feed route requires an authenticated session and returns feed payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const buildActivityFeed = t.mock.fn(async () => ({
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [
      {
        id: 'evt-1',
        eventType: 'request_created',
        entityTitle: 'OK Computer',
        occurredAt: '2026-06-01T11:00:00.000Z',
      },
    ],
    total: 1,
  }));
  const app = createActivityRouteTestApp({ buildActivityFeed, requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/feed`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildActivityFeed.mock.callCount(), 1);
    assert.equal(payload.ok, true);
    assert.equal(payload.checkedAt, '2026-06-01T12:00:00.000Z');
    assert.equal(payload.total, 1);
    assert.equal(payload.events[0].id, 'evt-1');
    assert.equal(payload.events[0].eventType, 'request_created');
  });
});

test('activity feed route returns 401 when requireSession throws auth_required', async () => {
  const app = createActivityRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/feed`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'auth_required');
  });
});

test('activity feed route forwards limit query param to buildActivityFeed', async (t) => {
  const buildActivityFeed = t.mock.fn(async () => ({
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [],
    total: 0,
  }));
  const app = createActivityRouteTestApp({ buildActivityFeed });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/feed?limit=10`);
    assert.equal(response.status, 200);

    const [args] = buildActivityFeed.mock.calls[0].arguments;
    assert.equal(args.limit, 10);
  });
});

test('activity feed route forwards eventType query param to buildActivityFeed', async (t) => {
  const buildActivityFeed = t.mock.fn(async () => ({
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [],
    total: 0,
  }));
  const app = createActivityRouteTestApp({ buildActivityFeed });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/feed?eventType=artist_monitored`);
    assert.equal(response.status, 200);

    const [args] = buildActivityFeed.mock.calls[0].arguments;
    assert.equal(args.eventType, 'artist_monitored');
  });
});

test('activity feed route passes undefined limit when query param is absent', async (t) => {
  const buildActivityFeed = t.mock.fn(async () => ({
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [],
    total: 0,
  }));
  const app = createActivityRouteTestApp({ buildActivityFeed });

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/activity/feed`);

    const [args] = buildActivityFeed.mock.calls[0].arguments;
    assert.equal(args.limit, undefined);
    assert.equal(args.eventType, null);
  });
});

test('activity blocklist route requires an admin session and returns list payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1' }));
  const listBlockedSourceUsers = t.mock.fn(async () => ({
    blockedSourceUsers: [
      {
        blockedAt: '2026-06-01T12:00:00.000Z',
        blockReason: 'Bad files',
        isBlocked: true,
        username: 'peer-1',
      },
    ],
    checkedAt: '2026-06-01T12:10:00.000Z',
    query: 'peer',
    total: 1,
  }));
  const app = createActivityRouteTestApp({ listBlockedSourceUsers, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/blocklist?q=peer`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(listBlockedSourceUsers.mock.callCount(), 1);
    assert.equal(payload.ok, true);
    assert.equal(payload.total, 1);
    assert.equal(payload.blockedSourceUsers[0].username, 'peer-1');
    assert.equal(listBlockedSourceUsers.mock.calls[0].arguments[0].query, 'peer');
  });
});

test('activity blocklist create route requires fresh admin csrf and returns created payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-token' }));
  const requireCsrf = t.mock.fn(() => {});
  const blockSourceUser = t.mock.fn(async () => ({ sourceUser: { username: 'peer-1' } }));
  const app = createActivityRouteTestApp({ blockSourceUser, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/blocklist`, {
      body: JSON.stringify({ operatorNotes: 'note', reason: 'Bad files', username: 'peer-1' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(blockSourceUser.mock.callCount(), 1);
    assert.equal(payload.sourceUser.username, 'peer-1');
  });
});

test('activity blocklist delete route requires fresh admin csrf and returns cleared payload', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-token' }));
  const requireCsrf = t.mock.fn(() => {});
  const unblockSourceUser = t.mock.fn(async () => ({ sourceUser: { username: 'peer-1' } }));
  const app = createActivityRouteTestApp({ requireCsrf, requireFreshAdminSession, unblockSourceUser });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/blocklist/peer-1`, {
      method: 'DELETE',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(unblockSourceUser.mock.callCount(), 1);
    assert.equal(payload.sourceUser.username, 'peer-1');
  });
});

test('activity feed route returns empty events list', async () => {
  const app = createActivityRouteTestApp({
    buildActivityFeed: async () => ({
      checkedAt: '2026-06-01T12:00:00.000Z',
      events: [],
      total: 0,
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/feed`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.events, []);
    assert.equal(payload.total, 0);
  });
});
