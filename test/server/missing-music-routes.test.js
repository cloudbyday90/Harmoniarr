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
      getMissingMusicDownloaderHandoff: async () => ({
        decisionId: 'wanted-amber',
        release: { artistName: 'Autechre', title: 'Amber' },
        requestedFor: { username: 'Jamie' },
        wantedReleaseId: 'wanted-amber',
      }),
      selectMissingMusicDecisionMatch: async () => ({ action: {} }),
      startMissingMusicDecisionDownload: async () => ({ action: {} }),
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
      requireAdminSession: async () => ({
        appUserId: 'admin-1',
        user: { role: 'admin', username: 'admin' },
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

test('Missing Music Downloader handoff uses an administrator session and forwards only the opaque decision ID', async (t) => {
  const getMissingMusicDownloaderHandoff = t.mock.fn(async () => ({
    decisionId: 'wanted-amber',
    release: { artistName: 'Autechre', title: 'Amber' },
    requestedFor: { username: 'Jamie' },
    wantedReleaseId: 'wanted-amber',
  }));
  const requireAdminSession = t.mock.fn(async () => ({
    appUserId: 'admin-1',
    user: { role: 'admin', username: 'admin' },
  }));
  const app = createMissingMusicRouteTestApp({
    getMissingMusicDownloaderHandoff,
    requireAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions/wanted-amber/downloader-handoff`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(getMissingMusicDownloaderHandoff.mock.calls[0].arguments[0], {
      actorUser: {
        id: 'admin-1',
        isDisabled: false,
        role: 'admin',
        username: 'admin',
      },
      decisionId: 'wanted-amber',
    });
    assert.deepEqual(payload, {
      decisionId: 'wanted-amber',
      ok: true,
      release: { artistName: 'Autechre', title: 'Amber' },
      requestedFor: { username: 'Jamie' },
      wantedReleaseId: 'wanted-amber',
    });
  });
});

test('Missing Music Downloader handoff preserves administrator authorization failures', async () => {
  const app = createMissingMusicRouteTestApp({
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'An administrator is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions/wanted-amber/downloader-handoff`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'admin_required');
  });
});

test('Missing Music match selection requires a fresh session, CSRF, and idempotent command contract', async (t) => {
  const executeIdempotentMutation = t.mock.fn(async ({ executeMutation }) => executeMutation());
  const requireFreshSession = t.mock.fn(async () => ({
    appUserId: 'admin-1',
    user: { role: 'admin', username: 'admin' },
  }));
  const requireCsrf = t.mock.fn(() => {});
  const selectMissingMusicDecisionMatch = t.mock.fn(async () => ({
    action: {
      code: 'use_match',
      decisionId: 'wanted-amber',
      downloadStarted: false,
      matchId: 'candidate-amber',
      targetUserId: 'user-1',
    },
  }));
  const app = createMissingMusicRouteTestApp({
    executeIdempotentMutation,
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requireCsrf,
    requireFreshSession,
    selectMissingMusicDecisionMatch,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions/wanted-amber/matches/candidate-amber/select`, {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'missing-music-select-1',
      },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.action.downloadStarted, false);
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(selectMissingMusicDecisionMatch.mock.calls[0].arguments[0], {
      actorUser: {
        id: 'admin-1',
        isDisabled: false,
        role: 'admin',
        username: 'admin',
      },
      decisionId: 'wanted-amber',
      matchId: 'candidate-amber',
      requestMetadata: { ipAddress: '127.0.0.1' },
    });
    assert.equal(executeIdempotentMutation.mock.calls[0].arguments[0].operationScope, 'missing-music.decisions.matches.select');
    assert.deepEqual(executeIdempotentMutation.mock.calls[0].arguments[0].requestPayload, {
      decisionId: 'wanted-amber',
      matchId: 'candidate-amber',
    });
  });
});

test('Missing Music download start requires a fresh administrator session, CSRF, and a decision-only idempotent command', async (t) => {
  const executeIdempotentMutation = t.mock.fn(async ({ executeMutation }) => executeMutation());
  const requireFreshAdminSession = t.mock.fn(async () => ({
    appUserId: 'admin-1',
    user: { role: 'admin', username: 'admin' },
  }));
  const requireCsrf = t.mock.fn(() => {});
  const startMissingMusicDecisionDownload = t.mock.fn(async () => ({
    action: {
      code: 'start_download',
      decisionId: 'wanted-amber',
      downloadPreparationStarted: true,
      operationRunId: 'run-amber',
    },
  }));
  const app = createMissingMusicRouteTestApp({
    executeIdempotentMutation,
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }),
    requireCsrf,
    requireFreshAdminSession,
    startMissingMusicDecisionDownload,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/missing-music/decisions/wanted-amber/start-download`, {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'missing-music-download-1',
      },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(payload.action.downloadPreparationStarted, true);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startMissingMusicDecisionDownload.mock.calls[0].arguments[0], {
      actorUser: {
        id: 'admin-1',
        isDisabled: false,
        role: 'admin',
        username: 'admin',
      },
      decisionId: 'wanted-amber',
      requestMetadata: { ipAddress: '127.0.0.1' },
    });
    assert.equal(executeIdempotentMutation.mock.calls[0].arguments[0].operationScope, 'missing-music.decisions.download.start');
    assert.deepEqual(executeIdempotentMutation.mock.calls[0].arguments[0].requestPayload, {
      decisionId: 'wanted-amber',
    });
  });
});
