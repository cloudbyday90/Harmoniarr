import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerSystemRoutes } from '../../src/server/routes/system-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createSystemRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerSystemRoutes(app, {
      appPort: 4312,
      buildLibraryScanSummary: async () => ({
        checkedAt: '2026-04-30T22:30:00.000Z',
        libraryRoot: '/srv/music',
        readiness: {
          status: 'ready',
          message: 'Shared library and staging paths are ready for the first library scan.',
        },
        summary: {
          status: 'not_started',
          message: 'Library paths are ready, but no library scan has been recorded yet.',
        },
        latestRun: null,
        nextAction: null,
      }),
      buildOnboardingSummary: async () => ({
        checkedAt: '2026-04-30T22:00:00.000Z',
        summary: {
          status: 'attention',
          completeStepCount: 3,
          totalStepCount: 5,
          issueCount: 2,
          message: '2 setup items need attention before scans or imports.',
        },
        nextAction: {
          label: 'Open Settings',
          to: '/app/settings',
        },
        steps: [{
          id: 'paths',
          title: 'Validate library and download paths',
          status: 'attention',
          message: 'Validation needs attention',
        }],
      }),
      buildSettingsPayload: async () => ({
        settings: {
          libraryPath: '/music/library',
          refreshIntervalMinutes: 30,
        },
        pathValidation: {
          checkedAt: '2026-04-30T20:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
          roots: [],
          downloadMappings: [],
          notes: {
            remoteSlskdValidation: 'local-only',
          },
        },
      }),
      getOverview: async () => ({
        service: {
          name: 'harmoniarr',
          version: '0.1.0-beta',
          startedAt: '2026-04-28T12:00:00.000Z',
        },
        database: {
          name: 'postgresql',
          pendingMigrations: 0,
        },
        pathValidation: {
          checkedAt: '2026-04-30T20:00:00.000Z',
          configuredDownloadMappings: 1,
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      requireCsrf: () => {},
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      updateSettings: async ({ patch, actorUserId, requestMetadata }) => ({
        settings: {
          ...patch,
          updatedBy: actorUserId,
          requestMetadata,
        },
        pathValidation: {
          checkedAt: '2026-04-30T20:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
          roots: [],
          downloadMappings: [],
          notes: {
            remoteSlskdValidation: 'local-only',
          },
        },
      }),
      ...overrides,
    });
  });
}

test('system health route returns the shared overview summary without dependency checks', async (t) => {
  const getOverview = t.mock.fn(async () => ({
    service: {
      name: 'harmoniarr-service',
      version: '0.1.0-beta',
      startedAt: '2026-04-28T18:00:00.000Z',
    },
    database: {
      name: 'embedded-postgres',
      pendingMigrations: 2,
    },
  }));
  const app = createSystemRouteTestApp({
    appPort: 4488,
    getOverview,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getOverview.mock.calls[0].arguments, [{ includeDependencies: false }]);
    assert.deepEqual(payload, {
      ok: true,
      service: 'harmoniarr-service',
      startedAt: '2026-04-28T18:00:00.000Z',
      appPort: 4488,
      database: 'embedded-postgres',
      pendingMigrations: 2,
      postgresDataDir: '/app/data/postgres/18/data',
    });
  });
});

test('system settings read route requires a session and returns shared settings payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-10' }));
  const buildSettingsPayload = t.mock.fn(async () => ({
    settings: {
      libraryPath: '/srv/music',
      refreshIntervalMinutes: 45,
    },
    pathValidation: {
      checkedAt: '2026-04-30T20:00:00.000Z',
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
      roots: [],
      downloadMappings: [],
      notes: {
        remoteSlskdValidation: 'local-only',
      },
    },
  }));
  const app = createSystemRouteTestApp({ requireSession, buildSettingsPayload });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildSettingsPayload.mock.callCount(), 1);
    assert.deepEqual(payload, {
      ok: true,
      settings: {
        libraryPath: '/srv/music',
        refreshIntervalMinutes: 45,
      },
      pathValidation: {
        checkedAt: '2026-04-30T20:00:00.000Z',
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
        roots: [],
        downloadMappings: [],
        notes: {
          remoteSlskdValidation: 'local-only',
        },
      },
    });
  });
});

test('system settings update route passes actor and request metadata to the shared update service', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-12', csrfToken: 'csrf-12' }));
  const requireCsrf = t.mock.fn();
  const updateSettings = t.mock.fn(async ({ patch, actorUserId, requestMetadata }) => ({
    settings: {
      ...patch,
      updatedBy: actorUserId,
      requestMetadata,
    },
    pathValidation: {
      checkedAt: '2026-04-30T20:00:00.000Z',
      summary: {
        status: 'healthy',
        message: 'Validated',
      },
      roots: [],
      downloadMappings: [],
      notes: {
        remoteSlskdValidation: 'local-only',
      },
    },
  }));
  const app = createSystemRouteTestApp({ requireSession, requireCsrf, updateSettings });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-12',
        'x-forwarded-for': '198.51.100.44',
        'user-agent': 'HarmoniarrSystemTest/1.0',
      },
      body: JSON.stringify({ refreshIntervalMinutes: 60 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(updateSettings.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[1].appUserId, 'user-12');
    assert.deepEqual(updateSettings.mock.calls[0].arguments, [{
      patch: { refreshIntervalMinutes: 60 },
      actorUserId: 'user-12',
      requestMetadata: {
        ipAddress: '198.51.100.44',
        userAgent: 'HarmoniarrSystemTest/1.0',
      },
    }]);
    assert.deepEqual(payload, {
      ok: true,
      settings: {
        refreshIntervalMinutes: 60,
        updatedBy: 'user-12',
        requestMetadata: {
          ipAddress: '198.51.100.44',
          userAgent: 'HarmoniarrSystemTest/1.0',
        },
      },
      pathValidation: {
        checkedAt: '2026-04-30T20:00:00.000Z',
        summary: {
          status: 'healthy',
          message: 'Validated',
        },
        roots: [],
        downloadMappings: [],
        notes: {
          remoteSlskdValidation: 'local-only',
        },
      },
    });
  });
});

test('system overview route requires a session and returns the shared overview payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-20' }));
  const getOverview = t.mock.fn(async () => ({
    service: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
      startedAt: '2026-04-28T20:00:00.000Z',
    },
      discoveryHeartbeat: {
        intervalLabel: '15 minutes',
        intervalMs: 900000,
        mode: 'automatic',
        source: 'default',
      },
      database: {
        name: 'postgresql',
        pendingMigrations: 1,
      },
      dependencies: [{
        provider: 'musicbrainz',
        status: 'degraded',
        code: 'musicbrainz_unavailable',
        details: {
          retryAfterMs: 2000,
          throttled: true,
        },
      }],
      pathValidation: {
        checkedAt: '2026-04-30T20:00:00.000Z',
        configuredDownloadMappings: 2,
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
    }));
  const app = createSystemRouteTestApp({ requireSession, getOverview });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/overview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(getOverview.mock.callCount(), 1);
    assert.deepEqual(getOverview.mock.calls[0].arguments, [{ includeDependencies: true }]);
    assert.deepEqual(payload, {
      service: {
        name: 'harmoniarr',
        version: '0.1.0-beta',
        startedAt: '2026-04-28T20:00:00.000Z',
      },
      discoveryHeartbeat: {
        intervalLabel: '15 minutes',
        intervalMs: 900000,
        mode: 'automatic',
        source: 'default',
      },
      database: {
        name: 'postgresql',
        pendingMigrations: 1,
      },
      dependencies: [{
        provider: 'musicbrainz',
        status: 'degraded',
        code: 'musicbrainz_unavailable',
        details: {
          retryAfterMs: 2000,
          throttled: true,
        },
      }],
      pathValidation: {
        checkedAt: '2026-04-30T20:00:00.000Z',
        configuredDownloadMappings: 2,
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
    });
  });
});

test('system onboarding route requires a session and returns the shared onboarding checklist payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-40' }));
  const buildOnboardingSummary = t.mock.fn(async () => ({
    checkedAt: '2026-04-30T22:00:00.000Z',
    summary: {
      status: 'attention',
      completeStepCount: 3,
      totalStepCount: 5,
      issueCount: 2,
      message: '2 setup items need attention before scans or imports.',
    },
    nextAction: {
      label: 'Open Settings',
      to: '/app/settings',
    },
    steps: [{
      id: 'paths',
      title: 'Validate library and download paths',
      status: 'attention',
      message: 'Validation needs attention',
    }],
  }));
  const app = createSystemRouteTestApp({ requireSession, buildOnboardingSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/onboarding`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildOnboardingSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      checkedAt: '2026-04-30T22:00:00.000Z',
      summary: {
        status: 'attention',
        completeStepCount: 3,
        totalStepCount: 5,
        issueCount: 2,
        message: '2 setup items need attention before scans or imports.',
      },
      nextAction: {
        label: 'Open Settings',
        to: '/app/settings',
      },
      steps: [{
        id: 'paths',
        title: 'Validate library and download paths',
        status: 'attention',
        message: 'Validation needs attention',
      }],
    });
  });
});

test('system library scan summary route requires a session and returns the shared scan readiness payload', async (t) => {
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-41' }));
  const buildLibraryScanSummary = t.mock.fn(async () => ({
    checkedAt: '2026-04-30T22:30:00.000Z',
    libraryRoot: '/srv/music',
    readiness: {
      status: 'ready',
      message: 'Shared library and staging paths are ready for the first library scan.',
    },
    summary: {
      status: 'not_started',
      message: 'Library paths are ready, but no library scan has been recorded yet.',
    },
    latestRun: null,
    nextAction: null,
  }));
  const app = createSystemRouteTestApp({ requireSession, buildLibraryScanSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/library-scan-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(buildLibraryScanSummary.mock.callCount(), 1);
    assert.deepEqual(payload, {
      checkedAt: '2026-04-30T22:30:00.000Z',
      libraryRoot: '/srv/music',
      readiness: {
        status: 'ready',
        message: 'Shared library and staging paths are ready for the first library scan.',
      },
      summary: {
        status: 'not_started',
        message: 'Library paths are ready, but no library scan has been recorded yet.',
      },
      latestRun: null,
      nextAction: null,
    });
  });
});

test('system settings read route preserves injected auth-required failures in the shared json error response', async () => {
  const app = createSystemRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'auth_required',
        message: 'Authentication is required',
      },
    });
  });
});

test('system settings update route preserves csrf failures from the injected guard', async () => {
  const app = createSystemRouteTestApp({
    requireSession: async () => ({ appUserId: 'user-30', csrfToken: 'csrf-30' }),
    requireCsrf: () => {
      throw createApiError(403, 'csrf_invalid', 'CSRF token is invalid');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refreshIntervalMinutes: 15 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'csrf_invalid',
        message: 'CSRF token is invalid',
      },
    });
  });
});
