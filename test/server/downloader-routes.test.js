import assert from 'node:assert/strict';
import test from 'node:test';
import { registerDownloaderRoutes } from '../../src/server/routes/downloader-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createDownloaderRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerDownloaderRoutes(app, {
      buildDownloaderQueue: async ({ includeRemoved }) => ({
        includeRemoved,
        observedAt: '2026-06-06T12:00:00.000Z',
        provider: 'slskd',
        queueHealth: {
          counts: {
            active: 0,
            completed: 0,
            failed: 0,
            other: 0,
            queued: 0,
            total: 0,
          },
          message: 'No transfers are currently visible.',
          progress: {
            bytesTransferred: null,
            percentComplete: null,
            size: null,
          },
          status: 'idle',
        },
        sourceGroups: [],
        transfers: [],
        truncated: false,
      }),
      clearCompletedDownloaderTransfers: async () => ({
        action: 'clear_completed',
        ok: true,
        provider: 'slskd',
      }),
      requestDownloaderTransferAction: async ({ action, id, username }) => ({
        action,
        id,
        ok: true,
        provider: 'slskd',
        sourceUser: username,
      }),
      requireAdminSession: async () => ({ appUserId: 'admin-1' }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'admin-1' }),
      ...overrides,
    });
  });
}

test('downloader queue route requires admin session and returns the read model', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1' }));
  const buildDownloaderQueue = t.mock.fn(async ({ includeRemoved }) => ({
    includeRemoved,
    observedAt: '2026-06-06T12:00:00.000Z',
    provider: 'slskd',
    queueHealth: {
      counts: {
        active: 1,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 1,
      },
      message: '1 active and 0 queued transfer is in the queue.',
      progress: {
        bytesTransferred: 50,
        percentComplete: 50,
        size: 100,
      },
      status: 'busy',
    },
    sourceGroups: [],
    transfers: [{
      id: 'transfer-1',
      sourceUser: 'source-user',
      state: { code: 'active', label: 'Downloading', raw: 'InProgress', terminal: false, tone: 'warning' },
      transferKey: 'source-user::transfer-1',
    }],
    truncated: false,
  }));
  const app = createDownloaderRouteTestApp({ buildDownloaderQueue, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/downloader/queue?includeRemoved=true`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(buildDownloaderQueue.mock.calls[0].arguments, [{ includeRemoved: 'true' }]);
    assert.deepEqual(payload, {
      ok: true,
      downloader: {
        includeRemoved: 'true',
        observedAt: '2026-06-06T12:00:00.000Z',
        provider: 'slskd',
        queueHealth: {
          counts: {
            active: 1,
            completed: 0,
            failed: 0,
            other: 0,
            queued: 0,
            total: 1,
          },
          message: '1 active and 0 queued transfer is in the queue.',
          progress: {
            bytesTransferred: 50,
            percentComplete: 50,
            size: 100,
          },
          status: 'busy',
        },
        sourceGroups: [],
        transfers: [{
          id: 'transfer-1',
          sourceUser: 'source-user',
          state: { code: 'active', label: 'Downloading', raw: 'InProgress', terminal: false, tone: 'warning' },
          transferKey: 'source-user::transfer-1',
        }],
        truncated: false,
      },
    });
  });
});

test('downloader queue route applies read rate-limit middleware before building the model', async (t) => {
  const calls = [];
  const app = createDownloaderRouteTestApp({
    buildDownloaderQueue: t.mock.fn(async () => {
      calls.push('build');
      return {};
    }),
    limitDownloaderQueueRead: (_request, _response, next) => {
      calls.push('limit');
      next();
    },
    requireAdminSession: async () => {
      calls.push('auth');
      return { appUserId: 'admin-1' };
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/downloader/queue`);

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['limit', 'auth', 'build']);
  });
});

test('downloader queue route normalizes slskd provider errors', async () => {
  const app = createDownloaderRouteTestApp({
    buildDownloaderQueue: async () => {
      const error = new Error('slskd download list request failed with status 503');
      error.code = 'slskd_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/downloader/queue`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unavailable',
        message: 'slskd is temporarily unavailable',
      },
    });
  });
});

test('downloader transfer action route enforces mutation middleware and delegates with decoded route params', async (t) => {
  const calls = [];
  const requestDownloaderTransferAction = t.mock.fn(async (input) => {
    calls.push('action');
    assert.equal(input.action, 'cancel');
    assert.equal(input.actorUserId, 'admin-1');
    assert.equal(input.id, 'transfer/id');
    assert.equal(input.username, 'source user');
    assert.equal(typeof input.request.headers, 'object');
    return {
      action: 'cancel',
      id: input.id,
      ok: true,
      provider: 'slskd',
      sourceUser: input.username,
    };
  });
  const app = createDownloaderRouteTestApp({
    limitDownloaderMutation: (_request, _response, next) => {
      calls.push('limit');
      next();
    },
    requestDownloaderTransferAction,
    requireCsrf: () => {
      calls.push('csrf');
    },
    requireFreshAdminSession: async () => {
      calls.push('fresh-auth');
      return { appUserId: 'admin-1' };
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/downloader/transfers/source%20user/transfer%2Fid/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['limit', 'fresh-auth', 'csrf', 'action']);
    assert.deepEqual(payload, {
      ok: true,
      downloaderAction: {
        action: 'cancel',
        id: 'transfer/id',
        ok: true,
        provider: 'slskd',
        sourceUser: 'source user',
      },
    });
  });
});

test('downloader clear completed route requires a fresh csrf-checked admin session', async (t) => {
  const calls = [];
  const clearCompletedDownloaderTransfers = t.mock.fn(async ({ actorUserId, request }) => {
    calls.push('clear');
    assert.equal(actorUserId, 'admin-1');
    assert.equal(typeof request.headers, 'object');
    return {
      action: 'clear_completed',
      ok: true,
      provider: 'slskd',
    };
  });
  const app = createDownloaderRouteTestApp({
    clearCompletedDownloaderTransfers,
    limitDownloaderMutation: (_request, _response, next) => {
      calls.push('limit');
      next();
    },
    requireCsrf: () => {
      calls.push('csrf');
    },
    requireFreshAdminSession: async () => {
      calls.push('fresh-auth');
      return { appUserId: 'admin-1' };
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/downloader/actions/clear-completed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['limit', 'fresh-auth', 'csrf', 'clear']);
    assert.deepEqual(payload, {
      ok: true,
      downloaderAction: {
        action: 'clear_completed',
        ok: true,
        provider: 'slskd',
      },
    });
  });
});
