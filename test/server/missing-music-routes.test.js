import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerMissingMusicRoutes } from '../../src/server/routes/missing-music-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createMissingMusicRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerMissingMusicRoutes(app, {
      getMissingMusicDecisionDetail: async () => ({
        checkedAt: '2026-08-26T16:30:00.000Z',
        decision: {},
        permissions: { isReadOnly: false },
        scope: 'mine',
      }),
      limitMissingMusicDecisionRead: (_request, _response, next) => next(),
      listMissingMusicDecisions: async () => ({
        checkedAt: '2026-08-26T16:30:00.000Z',
        decisions: [],
        filters: {},
        page: { limit: 50, offset: 0, total: 0 },
        scope: 'mine',
        users: [],
      }),
      requireSession: async () => ({
        appUserId: 'user-1',
        user: { role: 'requester', username: 'listener' },
      }),
      ...overrides,
    });
  });
}

test('Missing Music decisions route forwards bounded, labelled filter values with the authenticated actor', async (t) => {
  const listMissingMusicDecisions = t.mock.fn(async () => ({
    checkedAt: '2026-08-26T16:30:00.000Z',
    decisions: [],
    filters: {},
    page: { limit: 100, offset: 5, total: 0 },
    scope: 'all',
    users: [],
  }));
  const app = createMissingMusicRouteTestApp({
    listMissingMusicDecisions,
    requireSession: async () => ({
      appUserId: 'admin-1',
      user: { role: 'admin', username: 'admin' },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions?scope=all&requestedForUserId=user-2&accountStatus=disabled&state=action&q=portishead&limit=400&offset=5`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(listMissingMusicDecisions.mock.calls[0].arguments[0], {
      accountStatus: 'disabled',
      actorUser: {
        id: 'admin-1',
        isDisabled: false,
        role: 'admin',
        username: 'admin',
      },
      limit: 100,
      offset: 5,
      q: 'portishead',
      requestedForUserId: 'user-2',
      scope: 'all',
      state: 'action',
    });
    assert.equal(payload.ok, true);
    assert.equal(payload.scope, 'all');
  });
});

test('Missing Music decisions route preserves authentication errors', async () => {
  const app = createMissingMusicRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'auth_required');
  });
});

test('Missing Music detail route forwards only the route identifier and authenticated actor', async (t) => {
  const getMissingMusicDecisionDetail = t.mock.fn(async () => ({
    checkedAt: '2026-08-26T16:30:00.000Z',
    decision: { decisionId: 'wanted-amber' },
    permissions: { isReadOnly: false },
    scope: 'all',
  }));
  const app = createMissingMusicRouteTestApp({
    getMissingMusicDecisionDetail,
    requireSession: async () => ({
      appUserId: 'admin-1',
      user: { role: 'admin', username: 'admin' },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions/wanted-amber`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getMissingMusicDecisionDetail.mock.calls[0].arguments[0], {
      actorUser: {
        id: 'admin-1',
        isDisabled: false,
        role: 'admin',
        username: 'admin',
      },
      decisionId: 'wanted-amber',
    });
    assert.equal(payload.ok, true);
    assert.equal(payload.decision.decisionId, 'wanted-amber');
  });
});
