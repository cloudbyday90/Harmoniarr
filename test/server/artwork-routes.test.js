import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerArtworkRoutes } from '../../src/server/routes/artwork-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createArtworkRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerArtworkRoutes(app, {
      buildArtworkCleanupHistory: async () => ({
        checkedAt: '2026-05-01T12:05:00.000Z',
        runs: [
          {
            deletedAssetCount: 2,
            failedAssetCount: 0,
            id: 'artwork-run-0',
            startedAt: '2026-05-01T12:00:00.000Z',
            status: 'completed',
          },
        ],
      }),
      buildArtworkCleanupRunDetail: async ({ runId }) => ({
        checkedAt: '2026-05-01T12:06:00.000Z',
        run: {
          failures: [],
          id: runId,
          status: 'completed',
        },
      }),
      buildArtworkSummary: async () => ({
        checkedAt: '2026-05-01T12:00:00.000Z',
        cleanup: {
          retentionCutoff: '2026-01-31T12:00:00.000Z',
          unassignedRetentionDays: 90,
        },
        inventory: {
          eligibleAssetCount: 2,
          oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
          unassignedAssetCount: 4,
        },
        latestRun: null,
        summary: {
          status: 'ready',
          message: '2 unassigned artwork assets are eligible for retention cleanup now.',
        },
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      limitArtworkCleanupRun: (_request, _response, next) => next(),
      requireAdminSession: async () => ({ appUserId: 'user-1', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', user: { role: 'user' } }),
      startArtworkCleanupRun: async () => ({
        accepted: true,
        run: {
          id: 'artwork-run-1',
          status: 'pending',
        },
      }),
      writeDominantColor: async () => ({ ok: true, updated: true }),
      ...overrides,
    });
  });
}

test('artwork cleanup run detail route requires admin session and returns a single cleanup run', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-3', user: { role: 'admin' } }));
  const buildArtworkCleanupRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-05-01T12:06:00.000Z',
    run: {
      failures: [{
        artworkAssetId: 'asset-1',
        code: 'EACCES',
        message: 'Access denied',
        relativePath: 'artist/cover.jpg',
      }],
      id: runId,
      status: 'failed',
    },
  }));
  const app = createArtworkRouteTestApp({ buildArtworkCleanupRunDetail, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs/run-11`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(buildArtworkCleanupRunDetail.mock.calls[0].arguments, [{ runId: 'run-11' }]);
    assert.equal(payload.run.id, 'run-11');
    assert.equal(payload.run.failures[0].code, 'EACCES');
  });
});

test('artwork cleanup run detail route returns shared not found errors', async () => {
  const app = createArtworkRouteTestApp({
    buildArtworkCleanupRunDetail: async () => {
      throw createApiError(404, 'artwork_cleanup_run_not_found', 'Artwork cleanup run not found');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs/missing-run`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'artwork_cleanup_run_not_found');
  });
});

test('artwork cleanup history route requires admin session and returns recent cleanup runs', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-3', user: { role: 'admin' } }));
  const buildArtworkCleanupHistory = t.mock.fn(async ({ limit }) => ({
    checkedAt: '2026-05-01T12:05:00.000Z',
    runs: [
      {
        failedAssetCount: 1,
        failures: [{
          artworkAssetId: 'asset-9',
          code: 'EACCES',
          message: 'Access denied',
          relativePath: 'artist/cover.jpg',
        }],
        id: 'artwork-run-9',
        status: 'failed',
      },
    ],
  }));
  const app = createArtworkRouteTestApp({ buildArtworkCleanupHistory, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs?limit=3`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(buildArtworkCleanupHistory.mock.calls[0].arguments, [{ limit: '3' }]);
    assert.equal(payload.runs[0].id, 'artwork-run-9');
    assert.equal(payload.runs[0].failures[0].code, 'EACCES');
  });
});

test('artwork summary route requires admin session and returns the shared summary payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-3', user: { role: 'admin' } }));
  const buildArtworkSummary = t.mock.fn(async () => ({
    checkedAt: '2026-05-01T12:00:00.000Z',
    cleanup: {
      retentionCutoff: '2026-01-31T12:00:00.000Z',
      unassignedRetentionDays: 90,
    },
    inventory: {
      eligibleAssetCount: 1,
      oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
      unassignedAssetCount: 1,
    },
    latestRun: null,
    summary: {
      status: 'ready',
      message: '1 unassigned artwork asset is eligible for retention cleanup now.',
    },
  }));
  const app = createArtworkRouteTestApp({ buildArtworkSummary, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(buildArtworkSummary.mock.callCount(), 1);
    assert.equal(payload.summary.status, 'ready');
  });
});

test('artwork cleanup run route requires a fresh admin session and returns the accepted run payload', async (t) => {
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-7', csrfToken: 'csrf-7', user: { role: 'admin' } }));
  const startArtworkCleanupRun = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'artwork-run-7',
      requestMetadata,
      status: 'pending',
      triggeredByUserId,
    },
  }));
  const app = createArtworkRouteTestApp({ requireCsrf, requireFreshAdminSession, startArtworkCleanupRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-7',
        'x-forwarded-for': '198.51.100.44',
        'user-agent': 'HarmoniarrArtworkRouteTest/1.0',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startArtworkCleanupRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.44',
        userAgent: 'HarmoniarrArtworkRouteTest/1.0',
      },
      triggeredByUserId: 'user-7',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.run.id, 'artwork-run-7');
  });
});

test('artwork cleanup run route returns shared API errors from the run service', async () => {
  const app = createArtworkRouteTestApp({
    startArtworkCleanupRun: async () => {
      throw createApiError(409, 'artwork_cleanup_not_ready', 'Nothing eligible for cleanup');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'artwork_cleanup_not_ready');
  });
});

test('artwork cleanup run route returns lock conflicts from the run service', async () => {
  const app = createArtworkRouteTestApp({
    startArtworkCleanupRun: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents artwork cleanup');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/cleanup-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'recovery_lock_conflict');
  });
});

test('dominant color patch route requires an authenticated session and returns the write result', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', user: { role: 'user' } }));
  const writeDominantColor = t.mock.fn(async () => ({ ok: true, updated: true }));
  const app = createArtworkRouteTestApp({ requireSession, writeDominantColor });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-xyz/dominant-color`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hue: 180, chroma: 0.2, lightness: 0.5 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(writeDominantColor.mock.callCount(), 1);
    assert.deepEqual(writeDominantColor.mock.calls[0].arguments, [{
      artworkAssetId: 'asset-xyz',
      hue: 180,
      chroma: 0.2,
      lightness: 0.5,
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.updated, true);
  });
});

test('dominant color patch route returns 401 when session is not authenticated', async () => {
  const app = createArtworkRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-xyz/dominant-color`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hue: 180, chroma: 0.2, lightness: 0.5 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'auth_required');
  });
});

test('dominant color patch route propagates 422 from the write service for out-of-range values', async () => {
  const app = createArtworkRouteTestApp({
    writeDominantColor: async () => {
      throw createApiError(422, 'dominant_color_invalid', 'hue must be a number between 0 and 360');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-xyz/dominant-color`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hue: 999, chroma: 0.2, lightness: 0.5 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 422);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'dominant_color_invalid');
  });
});