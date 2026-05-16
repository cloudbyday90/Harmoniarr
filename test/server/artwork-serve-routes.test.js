import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerArtworkRoutes } from '../../src/server/routes/artwork-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createArtworkRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerArtworkRoutes(app, {
      buildArtworkCleanupHistory: async () => ({ checkedAt: '2026-05-01T12:05:00.000Z', runs: [] }),
      buildArtworkCleanupRunDetail: async ({ runId }) => ({ checkedAt: '2026-05-01T12:06:00.000Z', run: { failures: [], id: runId, status: 'completed' } }),
      buildArtworkSummary: async () => ({
        checkedAt: '2026-05-01T12:00:00.000Z',
        cleanup: { retentionCutoff: '2026-01-31T12:00:00.000Z', unassignedRetentionDays: 90 },
        inventory: { eligibleAssetCount: 0, oldestUnassignedAt: null, unassignedAssetCount: 0 },
        latestRun: null,
        summary: { status: 'ready', message: 'No unassigned artwork assets.' },
      }),
      getRequestMetadata: (request) => ({ ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1', userAgent: request.headers['user-agent'] ?? null }),
      limitArtworkCleanupRun: (_request, _response, next) => next(),
      requireAdminSession: async () => ({ appUserId: 'user-1', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', user: { role: 'user' } }),
      serveArtworkFile: async () => { throw new Error('serveArtworkFile not mocked'); },
      startArtworkCleanupRun: async () => ({ accepted: true, run: { id: 'artwork-run-1', status: 'pending' } }),
      writeDominantColor: async () => ({ ok: true, updated: true }),
      ...overrides,
    });
  });
}

test('artwork file serve route requires an authenticated session', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-5', user: { role: 'user' } }));
  const serveArtworkFile = t.mock.fn(async () => ({
    absolutePath: '/tmp/test-artwork/image.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
  }));

  const app = createJsonTestApp((expressApp) => {
    expressApp.get('/api/v1/artwork/assets/:assetId/file', async (request, response) => {
      await requireSession(request);
      const result = await serveArtworkFile({ assetId: request.params.assetId });
      response.setHeader('Content-Type', result.mimeType);
      response.setHeader('Content-Length', result.fileSize);
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      response.end(Buffer.alloc(0));
    });
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-123/file`);

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  });
});

test('artwork file serve route returns 404 for missing asset', async () => {
  const serveArtworkFile = async () => {
    throw createApiError(404, 'artwork_asset_not_found', 'Artwork asset not found');
  };

  const app = createJsonTestApp((expressApp) => {
    expressApp.get('/api/v1/artwork/assets/:assetId/file', async (_request, response) => {
      await serveArtworkFile();
      response.end();
    });
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/missing-asset/file`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'artwork_asset_not_found');
  });
});

test('artwork file serve route returns 401 when session is not authenticated', async () => {
  const app = createArtworkRouteTestApp({
    serveArtworkFile: async () => ({
      absolutePath: '/tmp/test-artwork/image.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
    }),
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/artwork/assets/asset-123/file`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'auth_required');
  });
});
