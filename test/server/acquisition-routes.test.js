import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerAcquisitionRoutes } from '../../src/server/routes/acquisition-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAcquisitionRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAcquisitionRoutes(app, {
      addMusicQueueReleaseToLibrary: async ({ wantedReleaseId }) => ({
        action: { code: 'add_to_library', outcome: 'queued', wantedReleaseId },
        release: { id: wantedReleaseId },
      }),
      allowMusicQueueReleaseFallbackQuality: async ({ wantedReleaseId }) => ({
        action: { code: 'allow_fallback_quality', wantedReleaseId },
        release: { id: wantedReleaseId },
      }),
      getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
      getMusicQueueRelease: async ({ wantedReleaseId }) => ({
        release: { id: wantedReleaseId, status: { code: 'queued_for_search' } },
      }),
      limitMusicQueueMutation: (_request, _response, next) => next(),
      limitMusicQueueRead: (_request, _response, next) => next(),
      listMusicQueueReleases: async ({ appUserId, limit, metadataArtistId, offset }) => ({
        checkedAt: '2026-06-28T12:00:00.000Z',
        pagination: { limit, offset, total: 1 },
        releases: [{ artistName: 'Forest Frank', id: 'wanted-1', metadataArtistId, scopedTo: appUserId }],
        summary: { counts: { queued_for_search: 1 }, total: 1 },
      }),
      recheckMusicQueueReleaseSafeAdd: async ({ wantedReleaseId }) => ({
        action: { code: 'recheck_library_add', outcome: 'queued', wantedReleaseId },
        release: { id: wantedReleaseId },
      }),
      rejectMusicQueueMatch: async ({ matchId, wantedReleaseId }) => ({
        action: { code: 'reject_match', matchId },
        release: { id: wantedReleaseId },
      }),
      requestMusicQueueReleaseRediscovery: async ({ wantedReleaseId }) => ({
        action: { code: 'search_again', wantedReleaseId },
        release: { id: wantedReleaseId },
      }),
      requireCsrf: () => {},
      requireFreshSession: async () => ({ appUserId: 'user-1' }),
      requireSession: async () => ({ appUserId: 'user-1' }),
      useMusicQueueMatch: async ({ matchId, wantedReleaseId }) => ({
        action: { code: 'use_match', matchId },
        release: { id: wantedReleaseId },
      }),
      ...overrides,
    });
  });
}

test('music queue releases route requires session and delegates scoped list read', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const listMusicQueueReleases = t.mock.fn(async ({ appUserId, limit, metadataArtistId, offset }) => ({
    checkedAt: '2026-06-28T12:00:00.000Z',
    pagination: { limit, offset, total: 1 },
    releases: [{ id: 'wanted-1', metadataArtistId, scopedTo: appUserId }],
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
      metadataArtistId: null,
      offset: 5,
    }]);
    assert.equal(payload.releases[0].id, 'wanted-1');
  });
});

test('music queue releases route forwards an optional artist scope through the session-scoped read', async (t) => {
  const listMusicQueueReleases = t.mock.fn(async ({ metadataArtistId }) => ({
    checkedAt: '2026-06-28T12:00:00.000Z',
    pagination: { limit: 25, offset: 0, total: 1 },
    releases: [{ id: 'wanted-1', metadataArtistId }],
    summary: { counts: { queued_for_search: 1 }, total: 1 },
  }));
  const app = createAcquisitionRouteTestApp({ listMusicQueueReleases });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases?metadataArtistId=artist-1&limit=25`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(listMusicQueueReleases.mock.calls[0].arguments, [{
      appUserId: 'user-1',
      limit: 25,
      metadataArtistId: 'artist-1',
      offset: 0,
    }]);
    assert.equal(payload.releases[0].metadataArtistId, 'artist-1');
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

test('music queue use-match route requires fresh session and CSRF before scoped mutation', async (t) => {
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const requireCsrf = t.mock.fn(() => {});
  const useMusicQueueMatch = t.mock.fn(async ({ matchId, wantedReleaseId }) => ({
    action: { code: 'use_match', matchId },
    release: { id: wantedReleaseId },
  }));
  const app = createAcquisitionRouteTestApp({
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requireCsrf,
    requireFreshSession,
    useMusicQueueMatch,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/matches/candidate-1/use`, {
      body: JSON.stringify({ reason: 'Use this one' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(useMusicQueueMatch.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      matchId: 'candidate-1',
      reason: 'Use this one',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});

test('music queue reject-match route delegates scoped mutation', async (t) => {
  const rejectMusicQueueMatch = t.mock.fn(async ({ matchId, wantedReleaseId }) => ({
    action: { code: 'reject_match', matchId },
    release: { id: wantedReleaseId },
  }));
  const app = createAcquisitionRouteTestApp({ rejectMusicQueueMatch });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/matches/candidate-1/reject`, {
      body: JSON.stringify({ reason: 'Not the album' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.action.code, 'reject_match');
    assert.deepEqual(rejectMusicQueueMatch.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      matchId: 'candidate-1',
      reason: 'Not the album',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});

test('music queue search-again route requires fresh session and CSRF before scoped retry', async (t) => {
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const requireCsrf = t.mock.fn(() => {});
  const requestMusicQueueReleaseRediscovery = t.mock.fn(async ({ wantedReleaseId }) => ({
    action: { code: 'search_again', wantedReleaseId },
    release: { id: wantedReleaseId },
  }));
  const app = createAcquisitionRouteTestApp({
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requestMusicQueueReleaseRediscovery,
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/search-again`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.code, 'search_again');
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(requestMusicQueueReleaseRediscovery.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});

test('music queue library-add recheck requires fresh session and CSRF before scoped recovery', async (t) => {
  const recheckMusicQueueReleaseSafeAdd = t.mock.fn(async ({ wantedReleaseId }) => ({
    action: { code: 'recheck_library_add', outcome: 'queued', wantedReleaseId },
    release: { id: wantedReleaseId },
  }));
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const requireCsrf = t.mock.fn(() => {});
  const app = createAcquisitionRouteTestApp({
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    recheckMusicQueueReleaseSafeAdd,
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/recheck-library-add`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.outcome, 'queued');
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(recheckMusicQueueReleaseSafeAdd.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});

test('music queue add-to-library requires fresh session and CSRF before its release-scoped safe add', async (t) => {
  const addMusicQueueReleaseToLibrary = t.mock.fn(async ({ wantedReleaseId }) => ({
    action: { code: 'add_to_library', outcome: 'queued', wantedReleaseId },
    release: { id: wantedReleaseId },
  }));
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const requireCsrf = t.mock.fn(() => {});
  const app = createAcquisitionRouteTestApp({
    addMusicQueueReleaseToLibrary,
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/add-to-library`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.code, 'add_to_library');
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(addMusicQueueReleaseToLibrary.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});

test('music queue allow-fallback-quality route requires fresh session and CSRF before scoped override', async (t) => {
  const allowMusicQueueReleaseFallbackQuality = t.mock.fn(async ({ wantedReleaseId }) => ({
    action: { code: 'allow_fallback_quality', wantedReleaseId },
    release: { id: wantedReleaseId },
  }));
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-1' }));
  const requireCsrf = t.mock.fn(() => {});
  const app = createAcquisitionRouteTestApp({
    allowMusicQueueReleaseFallbackQuality,
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requireCsrf,
    requireFreshSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/acquisition/releases/wanted-1/allow-fallback-quality`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.action.code, 'allow_fallback_quality');
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(allowMusicQueueReleaseFallbackQuality.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      appUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1' },
      wantedReleaseId: 'wanted-1',
    }]);
  });
});
