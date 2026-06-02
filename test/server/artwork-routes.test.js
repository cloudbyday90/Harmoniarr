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
      getQuotaHistory: async () => ({
        days: 30,
        history: {
          coverArtArchive: [{ date: '2026-05-15', requestCount: 50 }],
          fanartTv: [],
        },
        limit: 1000,
      }),
      getQuotaStatus: async () => ({
        date: '2026-06-15',
        limit: 1000,
        providers: [
          { exceeded: false, limit: 1000, provider: 'coverArtArchive', remaining: 950, used: 50 },
          { exceeded: false, limit: 1000, provider: 'fanartTv', remaining: 1000, used: 0 },
        ],
        totalUsed: 50,
      }),
      limitArtworkCleanupRun: (_request, _response, next) => next(),
      limitArtworkResolveBatch: (_request, _response, next) => next(),
      requireAdminSession: async () => ({ appUserId: 'user-1', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', user: { role: 'user' } }),
      resolveArtwork: async () => ({ url: null, assetId: null, cached: false, sourceProvider: null }),
      resolveArtworkBatch: async () => ({}),
      serveArtworkFile: async () => { throw new Error('serveArtworkFile not mocked'); },
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
    assert.deepEqual(buildArtworkCleanupHistory.mock.calls[0].arguments, [{ limit: 3 }]);
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

test('dominant color patch route requires an authenticated session and CSRF token and returns the write result', async (t) => {
  const requireCsrf = t.mock.fn();
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', csrfToken: 'csrf-5', user: { role: 'user' } }));
  const writeDominantColor = t.mock.fn(async () => ({ ok: true, updated: true }));
  const app = createArtworkRouteTestApp({ requireCsrf, requireSession, writeDominantColor });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-xyz/dominant-color`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-5' },
      body: JSON.stringify({ hue: 180, chroma: 0.2, lightness: 0.5 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[1].csrfToken, 'csrf-5');
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

test('dominant color patch route requires CSRF before writing', async (t) => {
  const writeDominantColor = t.mock.fn(async () => ({ ok: true, updated: true }));
  const app = createArtworkRouteTestApp({
    requireCsrf: () => {
      throw createApiError(403, 'csrf_invalid', 'CSRF token is invalid');
    },
    requireSession: async () => ({ appUserId: 'user-5', csrfToken: 'csrf-5', user: { role: 'user' } }),
    writeDominantColor,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-xyz/dominant-color`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hue: 180, chroma: 0.2, lightness: 0.5 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'csrf_invalid');
    assert.equal(writeDominantColor.mock.callCount(), 0);
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

test('artwork resolve route requires authenticated session', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', user: { role: 'user' } }));
  const resolveArtwork = t.mock.fn(async () => ({
    url: '/api/v1/artwork/assets/asset-1/file',
    assetId: 'asset-1',
    cached: true,
    sourceProvider: 'coverArtArchive',
  }));

  const app = createArtworkRouteTestApp({ requireSession, resolveArtwork });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve?owner_type=musicbrainz_release_group&owner_id=mbid-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(resolveArtwork.mock.callCount(), 1);
    assert.equal(payload.url, '/api/v1/artwork/assets/asset-1/file');
    assert.equal(payload.cached, true);
  });
});

test('artwork resolve route returns 400 when owner_type is missing', async () => {
  const app = createArtworkRouteTestApp({
    resolveArtwork: async () => ({ url: null, assetId: null, cached: false }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve?owner_id=mbid-1`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'validation_error');
  });
});

test('artwork resolve batch route returns 400 for empty requests array', async () => {
  const app = createArtworkRouteTestApp({
    resolveArtworkBatch: async () => ({}),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requests: [] }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'validation_error');
  });
});

test('artwork resolve batch route returns 400 when batch exceeds 50 items', async () => {
  const app = createArtworkRouteTestApp({
    resolveArtworkBatch: async () => ({}),
  });

  const bigBatch = Array.from({ length: 51 }, (_, i) => ({
    ownerType: 'musicbrainz_release_group',
    ownerId: `mbid-${i}`,
  }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requests: bigBatch }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'validation_error');
    assert.ok(payload.error.message.includes('50'));
  });
});

test('artwork resolve batch route returns resolved map', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', user: { role: 'user' } }));
  const resolveArtworkBatch = t.mock.fn(async (requests) => {
    const results = {};
    for (const r of requests) {
      results[`${r.ownerType}:${r.ownerId}:cover_front`] = {
        url: `/api/v1/artwork/assets/${r.ownerId}/file`,
        assetId: r.ownerId,
        cached: true,
      };
    }
    return results;
  });

  const app = createArtworkRouteTestApp({ requireSession, resolveArtworkBatch });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { owner_type: 'musicbrainz_release_group', owner_id: 'mbid-1' },
          { ownerType: 'musicbrainz_release_group', ownerId: 'mbid-2' },
        ],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.ok(payload.resolved);
    assert.ok(payload.resolved['musicbrainz_release_group:mbid-1:cover_front']);
    assert.ok(payload.resolved['musicbrainz_release_group:mbid-2:cover_front']);
  });
});

test('artwork resolve batch route forwards refresh parameter', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', user: { role: 'user' } }));
  const resolveArtworkBatch = t.mock.fn(async (requests) => {
    const results = {};
    for (const r of requests) {
      results[`${r.ownerType}:${r.ownerId}:${r.artworkRole}`] = {
        url: r.refresh ? `/api/v1/artwork/assets/${r.ownerId}-new/file` : `/api/v1/artwork/assets/${r.ownerId}/file`,
        assetId: r.refresh ? `${r.ownerId}-new` : r.ownerId,
        cached: !r.refresh,
      };
    }
    return results;
  });

  const app = createArtworkRouteTestApp({ requireSession, resolveArtworkBatch });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { owner_type: 'musicbrainz_release_group', owner_id: 'mbid-1', refresh: true },
          { ownerType: 'musicbrainz_release_group', ownerId: 'mbid-2', refresh: 'false' },
          { ownerType: 'musicbrainz_release_group', ownerId: 'mbid-3' },
        ],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(resolveArtworkBatch.mock.callCount(), 1);
    const batchRequests = resolveArtworkBatch.mock.calls[0].arguments[0];
    assert.equal(batchRequests[0].refresh, true);
    assert.equal(batchRequests[1].refresh, false);
    assert.equal(batchRequests[2].refresh, false);
    assert.equal(payload.resolved['musicbrainz_release_group:mbid-1:cover_front'].cached, false);
    assert.equal(payload.resolved['musicbrainz_release_group:mbid-2:cover_front'].cached, true);
  });
});

test('artwork quota route requires admin session and returns quota status', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const getQuotaStatus = t.mock.fn(async () => ({
    date: '2026-06-15',
    limit: 500,
    providers: [
      { exceeded: false, limit: 500, provider: 'coverArtArchive', remaining: 480, used: 20 },
      { exceeded: true, limit: 500, provider: 'fanartTv', remaining: 0, used: 500 },
    ],
    totalUsed: 520,
  }));

  const app = createArtworkRouteTestApp({ getQuotaStatus, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/quota`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(getQuotaStatus.mock.callCount(), 1);
    assert.equal(payload.limit, 500);
    assert.equal(payload.totalUsed, 520);
    assert.equal(payload.providers.length, 2);
    assert.equal(payload.providers[0].provider, 'coverArtArchive');
    assert.equal(payload.providers[0].used, 20);
    assert.equal(payload.providers[1].provider, 'fanartTv');
    assert.equal(payload.providers[1].exceeded, true);
  });
});

test('artwork resolve route passes refresh parameter', async (t) => {
  const resolveArtwork = t.mock.fn(async ({ refresh }) => ({
    cached: !refresh,
    url: refresh ? '/api/v1/artwork/assets/new/file' : '/api/v1/artwork/assets/cached/file',
    assetId: refresh ? 'new' : 'cached',
    sourceProvider: 'coverArtArchive',
  }));

  const app = createArtworkRouteTestApp({ resolveArtwork });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/resolve?owner_type=musicbrainz_release&owner_id=mbid-1&refresh=true`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(resolveArtwork.mock.calls[0].arguments[0].refresh, true);
    assert.equal(payload.cached, false);
    assert.equal(payload.url, '/api/v1/artwork/assets/new/file');
  });
});

test('artwork quota history route requires admin session and returns history', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const getQuotaHistory = t.mock.fn(async ({ days }) => ({
    days,
    history: {
      coverArtArchive: [
        { date: '2026-05-14', requestCount: 42 },
        { date: '2026-05-15', requestCount: 55 },
      ],
      fanartTv: [{ date: '2026-05-15', requestCount: 10 }],
    },
    limit: 100,
  }));

  const app = createArtworkRouteTestApp({ getQuotaHistory, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/quota/history?days=7`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(getQuotaHistory.mock.callCount(), 1);
    assert.equal(getQuotaHistory.mock.calls[0].arguments[0].days, 7);
    assert.equal(payload.days, 7);
    assert.equal(payload.limit, 100);
    assert.equal(payload.history.coverArtArchive.length, 2);
    assert.equal(payload.history.fanartTv.length, 1);
  });
});

test('artwork quota history route defaults to 30 days', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const getQuotaHistory = t.mock.fn(async ({ days }) => ({ days, history: {}, limit: 100 }));

  const app = createArtworkRouteTestApp({ getQuotaHistory, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/quota/history`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getQuotaHistory.mock.calls[0].arguments[0].days, 30);
    assert.equal(payload.days, 30);
  });
});
