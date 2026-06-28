import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerAcquisitionRoutes } from '../../src/server/routes/acquisition-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAcquisitionRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAcquisitionRoutes(app, {
      getMusicQueueRelease: async ({ wantedReleaseId }) => ({
        release: { id: wantedReleaseId, status: { code: 'queued_for_search' } },
      }),
      limitMusicQueueRead: (_request, _response, next) => next(),
      listMusicQueueReleases: async ({ appUserId, limit, offset }) => ({
        checkedAt: '2026-06-28T12:00:00.000Z',
        pagination: { limit, offset, total: 1 },
        releases: [{ artistName: 'Forest Frank', id: 'wanted-1', scopedTo: appUserId }],
        summary: { counts: { queued_for_search: 1 }, total: 1 },
      }),
      requireSession: async () => ({ appUserId: 'user-1' }),
      ...overrides,
    });
  });
}

test('music queue releases route requires session and delegates scoped list read', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const listMusicQueueReleases = t.mock.fn(async ({ appUserId, limit, offset }) => ({
    checkedAt: '2026-06-28T12:00:00.000Z',
    pagination: { limit, offset, total: 1 },
    releases: [{ id: 'wanted-1', scopedTo: appUserId }],
    summary: { counts: { queued_for_search: 1 }, total: 1 },
  }));
  const app = createAcquisitionRouteTestApp({ listMusicQueueReleases, requireSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases?limit=25&offset=5`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.deepEqual(listMusicQueueReleases.mock.calls[0].arguments, [{
      appUserId: 'user-1',
      limit: 25,
      offset: 5,
    }]);
    assert.equal(payload.releases[0].id, 'wanted-1');
  });
});

test('music queue release detail route delegates by wanted release id', async (t) => {
  const getMusicQueueRelease = t.mock.fn(async ({ appUserId, wantedReleaseId }) => ({
    release: { id: wantedReleaseId, scopedTo: appUserId },
  }));
  const app = createAcquisitionRouteTestApp({ getMusicQueueRelease });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getMusicQueueRelease.mock.calls[0].arguments, [{
      appUserId: 'user-1',
      wantedReleaseId: 'wanted-1',
    }]);
    assert.equal(payload.release.id, 'wanted-1');
  });
});

test('music queue routes return auth errors from requireSession', async () => {
  const app = createAcquisitionRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'auth_required');
  });
});
