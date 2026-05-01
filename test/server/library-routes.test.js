import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerLibraryRoutes } from '../../src/server/routes/library-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createLibraryRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerLibraryRoutes(app, {
      buildLibraryDiscoverySummary: async () => ({
        heartbeat: {
          intervalLabel: '15 minutes',
          intervalMs: 900000,
          mode: 'automatic',
          source: 'default',
        },
        lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
        latestRun: null,
        nextEligibleAt: '2026-04-30T18:00:00.000Z',
        requestCounts: {
          blocked: 1,
          cooldown: 2,
          ready: 3,
          totalRequests: 6,
        },
        summary: {
          status: 'ready',
          message: '3 discovery requests are ready to search now.',
        },
      }),
      buildLibraryReconciliationSummary: async () => ({
        fileCounts: {
          ambiguous: 1,
          ignored: 0,
          matched: 2,
          observed: 3,
          unmatched: 0,
        },
        lastReconciledAt: '2026-04-30T12:40:00.000Z',
        releaseCounts: {
          complete: 1,
          duplicate: 0,
          partial: 1,
        },
        summary: {
          status: 'partial',
          message: '1 release is partially satisfied by the current library.',
        },
      }),
      buildLibraryWantedSummary: async () => ({
        lastReconciledAt: '2026-04-30T13:20:00.000Z',
        monitoredArtistCount: 2,
        releaseCounts: {
          missing: 1,
          partial: 1,
          totalWanted: 2,
        },
        summary: {
          status: 'wanted',
          message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
        },
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      requireCsrf: () => {},
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      startLibraryDiscoveryRun: async () => ({
        accepted: true,
        run: {
          id: 'discovery-run-1',
          status: 'pending',
        },
      }),
      startLibraryScan: async () => ({
        accepted: true,
        run: {
          id: 'run-1',
          status: 'pending',
        },
      }),
      ...overrides,
    });
  });
}

test('library discovery summary route requires a session and returns the shared discovery payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-19', csrfToken: 'csrf-19' }));
  const buildLibraryDiscoverySummary = t.mock.fn(async () => ({
    heartbeat: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
    latestRun: null,
    nextEligibleAt: '2026-04-30T18:00:00.000Z',
    requestCounts: {
      blocked: 1,
      cooldown: 2,
      ready: 3,
      totalRequests: 6,
    },
    summary: {
      status: 'ready',
      message: '3 discovery requests are ready to search now.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryDiscoverySummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryDiscoverySummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      heartbeat: {
        intervalLabel: '15 minutes',
        intervalMs: 900000,
        mode: 'automatic',
        source: 'default',
      },
      lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
      latestRun: null,
      nextEligibleAt: '2026-04-30T18:00:00.000Z',
      requestCounts: {
        blocked: 1,
        cooldown: 2,
        ready: 3,
        totalRequests: 6,
      },
      summary: {
        status: 'ready',
        message: '3 discovery requests are ready to search now.',
      },
    });
  });
});

test('library discovery run start route requires a session and returns the accepted run payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-23', csrfToken: 'csrf-23' }));
  const requireCsrf = t.mock.fn();
  const startLibraryDiscoveryRun = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'discovery-run-4',
      requestMetadata,
      status: 'pending',
      triggeredByUserId,
    },
  }));
  const app = createLibraryRouteTestApp({ requireCsrf, requireSession, startLibraryDiscoveryRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/discovery-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-23',
        'x-forwarded-for': '198.51.100.44',
        'user-agent': 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.44',
        userAgent: 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
      },
      triggeredByUserId: 'user-23',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      accepted: true,
      run: {
        id: 'discovery-run-4',
        requestMetadata: {
          ipAddress: '198.51.100.44',
          userAgent: 'HarmoniarrLibraryDiscoveryRouteTest/1.0',
        },
        status: 'pending',
        triggeredByUserId: 'user-23',
      },
    });
  });
});

test('library reconciliation summary route requires a session and returns the shared summary payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-17', csrfToken: 'csrf-17' }));
  const buildLibraryReconciliationSummary = t.mock.fn(async () => ({
    fileCounts: {
      ambiguous: 1,
      ignored: 0,
      matched: 8,
      observed: 9,
      unmatched: 0,
    },
    lastReconciledAt: '2026-04-30T12:40:00.000Z',
    releaseCounts: {
      complete: 3,
      duplicate: 0,
      partial: 1,
    },
    summary: {
      status: 'partial',
      message: '1 release is partially satisfied by the current library.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryReconciliationSummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/reconciliation-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryReconciliationSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      fileCounts: {
        ambiguous: 1,
        ignored: 0,
        matched: 8,
        observed: 9,
        unmatched: 0,
      },
      lastReconciledAt: '2026-04-30T12:40:00.000Z',
      releaseCounts: {
        complete: 3,
        duplicate: 0,
        partial: 1,
      },
      summary: {
        status: 'partial',
        message: '1 release is partially satisfied by the current library.',
      },
    });
  });
});

test('library wanted summary route requires a session and returns the shared wanted payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-21', csrfToken: 'csrf-21' }));
  const buildLibraryWantedSummary = t.mock.fn(async () => ({
    lastReconciledAt: '2026-04-30T13:20:00.000Z',
    monitoredArtistCount: 2,
    releaseCounts: {
      missing: 1,
      partial: 1,
      totalWanted: 2,
    },
    summary: {
      status: 'wanted',
      message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
    },
  }));
  const app = createLibraryRouteTestApp({
    buildLibraryWantedSummary,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/wanted-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryWantedSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      lastReconciledAt: '2026-04-30T13:20:00.000Z',
      monitoredArtistCount: 2,
      releaseCounts: {
        missing: 1,
        partial: 1,
        totalWanted: 2,
      },
      summary: {
        status: 'wanted',
        message: '2 monitored releases still need files, including fully missing and partially satisfied releases.',
      },
    });
  });
});

test('library scan start route requires a session and returns the accepted run payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-17', csrfToken: 'csrf-17' }));
  const requireCsrf = t.mock.fn();
  const startLibraryScan = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'run-4',
      requestMetadata,
      status: 'pending',
      triggeredByUserId,
    },
  }));
  const app = createLibraryRouteTestApp({ requireCsrf, requireSession, startLibraryScan });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/scan-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-17',
        'x-forwarded-for': '198.51.100.88',
        'user-agent': 'HarmoniarrLibraryRouteTest/1.0',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(startLibraryScan.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.88',
        userAgent: 'HarmoniarrLibraryRouteTest/1.0',
      },
      triggeredByUserId: 'user-17',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      accepted: true,
      run: {
        id: 'run-4',
        requestMetadata: {
          ipAddress: '198.51.100.88',
          userAgent: 'HarmoniarrLibraryRouteTest/1.0',
        },
        status: 'pending',
        triggeredByUserId: 'user-17',
      },
    });
  });
});

test('library scan start route forwards service errors to the api error handler', async () => {
  const app = createLibraryRouteTestApp({
    startLibraryScan: async () => {
      throw createApiError(409, 'library_scan_in_progress', 'A library scan is already running or queued');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/library/scan-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'library_scan_in_progress',
        message: 'A library scan is already running or queued',
      },
    });
  });
});