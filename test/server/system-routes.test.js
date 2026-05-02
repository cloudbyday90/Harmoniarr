import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerSystemRoutes } from '../../src/server/routes/system-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createSystemRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerSystemRoutes(app, {
      appPort: 4312,
      createBackupExport: async ({ triggeredByUserId }) => ({
        accepted: true,
        backupArtifact: {
          id: 'backup-1',
          filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
          createdByUserId: triggeredByUserId,
        },
      }),
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
      getActivityFeed: async () => ({
        checkedAt: '2026-05-02T12:15:00.000Z',
        entries: [],
        pageInfo: {
          hasMore: false,
          nextCursor: null,
        },
      }),
      getBackupExportById: async ({ backupArtifactId }) => ({
        backupArtifact: {
          id: backupArtifactId,
          filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
          formatVersion: '1',
          backupType: 'logical',
        },
      }),
      getBackupRestorePreview: async ({ backupArtifactId }) => ({
        backupArtifact: {
          id: backupArtifactId,
          filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
          formatVersion: '1',
        },
        compatibility: {
          compatible: true,
          checks: [],
        },
        integrity: {
          status: 'passed',
        },
        restoreReadiness: {
          blockedByLock: false,
          blockingLocks: [],
        },
        canApplyRestore: true,
        checkedAt: '2026-05-02T12:18:00.000Z',
      }),
      startBackupRestoreApply: async ({ backupArtifactId, expectedPayloadSha256, triggeredByUserId }) => ({
        accepted: true,
        backupArtifact: {
          id: backupArtifactId,
        },
        restoreResult: {
          appliedScopes: ['settings'],
          settingsUpdated: true,
        },
        source: {
          expectedPayloadSha256,
          triggeredByUserId,
        },
        run: {
          id: 'run-restore-1',
          status: 'completed',
        },
      }),
      getOperatorNotifications: async ({ limit }) => ({
        checkedAt: '2026-05-02T12:16:00.000Z',
        counts: {
          actionable: 1,
          byCategory: {
            failure: 1,
            manual_intervention: 0,
            queued_work: 0,
            recovery: 0,
          },
          total: 1,
        },
        notifications: [{
          category: 'failure',
          id: 'run:run-1:failure',
          message: `Notification limit ${limit ?? 'default'}`,
          occurredAt: '2026-05-02T12:14:00.000Z',
          requiresAction: true,
          severity: 'error',
          title: 'Library scan failed',
        }],
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      requireAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      listBackupExports: async ({ limit }) => ({
        backupArtifacts: [{
          id: 'backup-1',
          filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
        }],
        checkedAt: `limit:${limit ?? 'default'}`,
      }),
      startOperatorNotificationFanoutRun: async () => ({
        accepted: true,
        run: {
          id: 'fanout-run-1',
          status: 'pending',
        },
      }),
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

test('backup export create route enforces csrf and returns accepted backup artifact', async (t) => {
  const createBackupExport = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    backupArtifact: {
      id: 'backup-44',
      filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
      requestMetadata,
      triggeredByUserId,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createSystemRouteTestApp({ createBackupExport, requireCsrf });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/backups`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.45',
        'user-agent': 'HarmoniarrBackupRouteTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(createBackupExport.mock.callCount(), 1);
    assert.deepEqual(createBackupExport.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '198.51.100.45',
        userAgent: 'HarmoniarrBackupRouteTest/1.0',
      },
      triggeredByUserId: 'user-1',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.backupArtifact.id, 'backup-44');
  });
});

test('backup export list route requires admin session and returns backup artifacts', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-1', user: { role: 'admin' } }));
  const listBackupExports = t.mock.fn(async ({ limit }) => ({
    backupArtifacts: [{
      id: 'backup-1',
      filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
    }],
    checkedAt: `limit:${limit}`,
  }));
  const app = createSystemRouteTestApp({ listBackupExports, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/backups?limit=10`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(listBackupExports.mock.calls[0].arguments, [{
      limit: '10',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.backupArtifacts.length, 1);
  });
});

test('backup export detail route requires admin session and returns artifact detail', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-1', user: { role: 'admin' } }));
  const getBackupExportById = t.mock.fn(async ({ backupArtifactId }) => ({
    backupArtifact: {
      id: backupArtifactId,
      filename: 'harmoniarr_backup_2026-05-02T12-00-00-000Z.json',
    },
  }));
  const app = createSystemRouteTestApp({ getBackupExportById, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/backups/backup-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(getBackupExportById.mock.calls[0].arguments, [{
      backupArtifactId: 'backup-1',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.backupArtifact.id, 'backup-1');
  });
});

test('backup restore preview route requires admin session and returns preview payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-1', user: { role: 'admin' } }));
  const getBackupRestorePreview = t.mock.fn(async ({ backupArtifactId }) => ({
    backupArtifact: {
      id: backupArtifactId,
      formatVersion: '1',
    },
    compatibility: {
      compatible: true,
      checks: [],
    },
    integrity: {
      status: 'passed',
    },
    restoreReadiness: {
      blockedByLock: false,
      blockingLocks: [],
    },
    canApplyRestore: true,
    checkedAt: '2026-05-02T12:18:00.000Z',
  }));
  const app = createSystemRouteTestApp({ getBackupRestorePreview, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/backups/backup-1/restore-preview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.deepEqual(getBackupRestorePreview.mock.calls[0].arguments, [{
      backupArtifactId: 'backup-1',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.backupArtifact.id, 'backup-1');
    assert.equal(payload.canApplyRestore, true);
  });
});

test('backup restore apply route enforces fresh admin session and csrf and returns restore run payload', async (t) => {
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-9', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const startBackupRestoreApply = t.mock.fn(async ({ backupArtifactId, expectedPayloadSha256, requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    backupArtifact: {
      id: backupArtifactId,
    },
    restoreResult: {
      appliedScopes: ['settings'],
      settingsUpdated: true,
    },
    source: {
      expectedPayloadSha256,
      requestMetadata,
      triggeredByUserId,
    },
    run: {
      id: 'run-restore-9',
      status: 'completed',
    },
  }));
  const app = createSystemRouteTestApp({
    requireCsrf,
    requireFreshAdminSession,
    startBackupRestoreApply,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/backups/backup-1/restore-apply`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.61',
        'user-agent': 'HarmoniarrBackupRestoreApplyRouteTest/1.0',
      },
      body: JSON.stringify({
        expectedPayloadSha256: 'sha-expected',
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startBackupRestoreApply.mock.callCount(), 1);
    assert.deepEqual(startBackupRestoreApply.mock.calls[0].arguments, [{
      backupArtifactId: 'backup-1',
      expectedPayloadSha256: 'sha-expected',
      requestMetadata: {
        ipAddress: '198.51.100.61',
        userAgent: 'HarmoniarrBackupRestoreApplyRouteTest/1.0',
      },
      triggeredByUserId: 'user-9',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.run.id, 'run-restore-9');
  });
});

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
    assert.deepEqual(getOverview.mock.calls[0].arguments, [{ includeArtworkMaintenance: false, includeDependencies: false }]);
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
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-10', user: { role: 'admin' } }));
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
  const app = createSystemRouteTestApp({ requireAdminSession, buildSettingsPayload });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
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
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-12', csrfToken: 'csrf-12', user: { role: 'admin' } }));
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
  const app = createSystemRouteTestApp({ requireFreshAdminSession, requireCsrf, updateSettings });

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
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
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
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-20', user: { role: 'admin' } }));
  const getOverview = t.mock.fn(async () => ({
    artwork: {
      fetch: {
        enabled: true,
        providerOrder: ['coverArtArchive'],
        refetchMissingAutomatically: false,
      },
    },
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
      importExecutionHeartbeat: {
        intervalLabel: '10 minutes',
        intervalMs: 600000,
        mode: 'automatic',
        source: 'default',
        state: {
          lastErrorMessage: null,
          lastOutcome: 'started',
          lastSkipReason: null,
          lastTickAt: '2026-04-30T20:04:00.000Z',
          lastTriggeredAt: '2026-04-30T20:04:00.000Z',
        },
      },
      metadataRefreshHeartbeat: {
        intervalLabel: '24 hours',
        intervalMs: 86400000,
        mode: 'automatic',
        source: 'default',
        state: {
          lastErrorMessage: null,
          lastOutcome: 'skipped',
          lastPauseCode: 'musicbrainz_unavailable',
          lastPauseMessage: 'MusicBrainz is throttling requests',
          lastPauseProvider: 'musicbrainz',
          lastSkipReason: 'paused',
          lastTickAt: '2026-04-30T20:05:00.000Z',
          lastTriggeredAt: null,
          nextRetryAt: '2026-04-30T20:10:00.000Z',
        },
      },
      heartbeats: [
        {
          key: 'libraryDiscovery',
          label: 'Discovery dispatch',
          intervalLabel: '15 minutes',
          intervalMs: 900000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: null,
          lastSkipReason: 'not_due',
          lastTickAt: '2026-04-30T20:03:00.000Z',
          lastTriggeredAt: null,
          message: 'No discovery requests are currently due for automatic dispatch.',
          nextRetryAt: null,
          state: {
            lastErrorMessage: null,
            lastOutcome: 'skipped',
            lastSkipReason: 'not_due',
            lastTickAt: '2026-04-30T20:03:00.000Z',
            lastTriggeredAt: null,
          },
          status: 'idle',
        },
        {
          key: 'importExecution',
          label: 'Import reconciliation',
          intervalLabel: '10 minutes',
          intervalMs: 600000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: null,
          lastSkipReason: null,
          lastTickAt: '2026-04-30T20:04:00.000Z',
          lastTriggeredAt: '2026-04-30T20:04:00.000Z',
          message: 'Import reconciliation most recently persisted import transfer state.',
          nextRetryAt: null,
          state: {
            lastErrorMessage: null,
            lastOutcome: 'started',
            lastSkipReason: null,
            lastTickAt: '2026-04-30T20:04:00.000Z',
            lastTriggeredAt: '2026-04-30T20:04:00.000Z',
          },
          status: 'running',
        },
        {
          key: 'metadataRefresh',
          label: 'Metadata refresh',
          intervalLabel: '24 hours',
          intervalMs: 86400000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: 'musicbrainz',
          lastSkipReason: 'paused',
          lastTickAt: '2026-04-30T20:05:00.000Z',
          lastTriggeredAt: null,
          message: 'MusicBrainz is throttling requests',
          nextRetryAt: '2026-04-30T20:10:00.000Z',
          state: {
            lastErrorMessage: null,
            lastOutcome: 'skipped',
            lastPauseCode: 'musicbrainz_unavailable',
            lastPauseMessage: 'MusicBrainz is throttling requests',
            lastPauseProvider: 'musicbrainz',
            lastSkipReason: 'paused',
            lastTickAt: '2026-04-30T20:05:00.000Z',
            lastTriggeredAt: null,
            nextRetryAt: '2026-04-30T20:10:00.000Z',
          },
          status: 'paused',
        },
      ],
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
  const app = createSystemRouteTestApp({ requireAdminSession, getOverview });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/overview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(getOverview.mock.callCount(), 1);
    assert.deepEqual(getOverview.mock.calls[0].arguments, [{ includeDependencies: true }]);
    assert.deepEqual(payload, {
      artwork: {
        fetch: {
          enabled: true,
          providerOrder: ['coverArtArchive'],
          refetchMissingAutomatically: false,
        },
      },
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
      importExecutionHeartbeat: {
        intervalLabel: '10 minutes',
        intervalMs: 600000,
        mode: 'automatic',
        source: 'default',
        state: {
          lastErrorMessage: null,
          lastOutcome: 'started',
          lastSkipReason: null,
          lastTickAt: '2026-04-30T20:04:00.000Z',
          lastTriggeredAt: '2026-04-30T20:04:00.000Z',
        },
      },
      metadataRefreshHeartbeat: {
        intervalLabel: '24 hours',
        intervalMs: 86400000,
        mode: 'automatic',
        source: 'default',
        state: {
          lastErrorMessage: null,
          lastOutcome: 'skipped',
          lastPauseCode: 'musicbrainz_unavailable',
          lastPauseMessage: 'MusicBrainz is throttling requests',
          lastPauseProvider: 'musicbrainz',
          lastSkipReason: 'paused',
          lastTickAt: '2026-04-30T20:05:00.000Z',
          lastTriggeredAt: null,
          nextRetryAt: '2026-04-30T20:10:00.000Z',
        },
      },
      heartbeats: [
        {
          key: 'libraryDiscovery',
          label: 'Discovery dispatch',
          intervalLabel: '15 minutes',
          intervalMs: 900000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: null,
          lastSkipReason: 'not_due',
          lastTickAt: '2026-04-30T20:03:00.000Z',
          lastTriggeredAt: null,
          message: 'No discovery requests are currently due for automatic dispatch.',
          nextRetryAt: null,
          state: {
            lastErrorMessage: null,
            lastOutcome: 'skipped',
            lastSkipReason: 'not_due',
            lastTickAt: '2026-04-30T20:03:00.000Z',
            lastTriggeredAt: null,
          },
          status: 'idle',
        },
        {
          key: 'importExecution',
          label: 'Import reconciliation',
          intervalLabel: '10 minutes',
          intervalMs: 600000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: null,
          lastSkipReason: null,
          lastTickAt: '2026-04-30T20:04:00.000Z',
          lastTriggeredAt: '2026-04-30T20:04:00.000Z',
          message: 'Import reconciliation most recently persisted import transfer state.',
          nextRetryAt: null,
          state: {
            lastErrorMessage: null,
            lastOutcome: 'started',
            lastSkipReason: null,
            lastTickAt: '2026-04-30T20:04:00.000Z',
            lastTriggeredAt: '2026-04-30T20:04:00.000Z',
          },
          status: 'running',
        },
        {
          key: 'metadataRefresh',
          label: 'Metadata refresh',
          intervalLabel: '24 hours',
          intervalMs: 86400000,
          mode: 'automatic',
          source: 'default',
          lastErrorMessage: null,
          lastPauseProvider: 'musicbrainz',
          lastSkipReason: 'paused',
          lastTickAt: '2026-04-30T20:05:00.000Z',
          lastTriggeredAt: null,
          message: 'MusicBrainz is throttling requests',
          nextRetryAt: '2026-04-30T20:10:00.000Z',
          state: {
            lastErrorMessage: null,
            lastOutcome: 'skipped',
            lastPauseCode: 'musicbrainz_unavailable',
            lastPauseMessage: 'MusicBrainz is throttling requests',
            lastPauseProvider: 'musicbrainz',
            lastSkipReason: 'paused',
            lastTickAt: '2026-04-30T20:05:00.000Z',
            lastTriggeredAt: null,
            nextRetryAt: '2026-04-30T20:10:00.000Z',
          },
          status: 'paused',
        },
      ],
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

test('operator notification fan-out route requires fresh admin session and starts a queued run', async (t) => {
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-3', csrfToken: 'csrf-admin-3', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const startOperatorNotificationFanoutRun = t.mock.fn(async ({ requestMetadata, triggeredByUserId }) => ({
    accepted: true,
    run: {
      id: 'fanout-run-2',
      status: 'pending',
      requestMetadata,
      triggeredByUserId,
    },
  }));
  const app = createSystemRouteTestApp({
    requireFreshAdminSession,
    requireCsrf,
    startOperatorNotificationFanoutRun,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/operator-notification-fanout-runs`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-admin-3',
        'x-forwarded-for': '198.51.100.9',
        'user-agent': 'HarmoniarrSystemRouteTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startOperatorNotificationFanoutRun.mock.callCount(), 1);
    assert.deepEqual(startOperatorNotificationFanoutRun.mock.calls[0].arguments[0], {
      requestMetadata: {
        ipAddress: '198.51.100.9',
        userAgent: 'HarmoniarrSystemRouteTest/1.0',
      },
      triggeredByUserId: 'admin-3',
    });
    assert.equal(payload.ok, true);
    assert.equal(payload.run.id, 'fanout-run-2');
  });
});

test('system activity feed route returns the shared paginated feed payload', async (t) => {
  const getActivityFeed = t.mock.fn(async ({ before, limit }) => ({
    checkedAt: '2026-05-02T12:15:00.000Z',
    entries: [{
      entryType: 'operation',
      id: 'run-1',
      message: 'Library scan completed successfully.',
      occurredAt: '2026-05-02T12:14:00.000Z',
      operationType: 'library_scan',
      runId: 'run-1',
      status: 'success',
      title: 'Library scan',
    }],
    pageInfo: {
      hasMore: true,
      nextCursor: 'cursor-2',
    },
  }));
  const app = createSystemRouteTestApp({ getActivityFeed });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/activity-feed?before=cursor-1&limit=12`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getActivityFeed.mock.calls[0].arguments, [{ before: 'cursor-1', limit: '12' }]);
    assert.deepEqual(payload, {
      checkedAt: '2026-05-02T12:15:00.000Z',
      entries: [{
        entryType: 'operation',
        id: 'run-1',
        message: 'Library scan completed successfully.',
        occurredAt: '2026-05-02T12:14:00.000Z',
        operationType: 'library_scan',
        runId: 'run-1',
        status: 'success',
        title: 'Library scan',
      }],
      pageInfo: {
        hasMore: true,
        nextCursor: 'cursor-2',
      },
    });
  });
});

test('system operator notifications route returns the shared actionable-notification payload', async (t) => {
  const getOperatorNotifications = t.mock.fn(async ({ limit }) => ({
    checkedAt: '2026-05-02T12:16:00.000Z',
    counts: {
      actionable: 1,
      byCategory: {
        failure: 1,
        manual_intervention: 0,
        queued_work: 0,
        recovery: 0,
      },
      total: 1,
    },
    notifications: [{
      category: 'failure',
      id: 'run:run-1:failure',
      message: `Notification limit ${limit ?? 'default'}`,
      occurredAt: '2026-05-02T12:14:00.000Z',
      requiresAction: true,
      severity: 'error',
      title: 'Library scan failed',
    }],
  }));
  const app = createSystemRouteTestApp({ getOperatorNotifications });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/operator-notifications?limit=12`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getOperatorNotifications.mock.calls[0].arguments, [{ limit: '12' }]);
    assert.equal(payload.counts.actionable, 1);
    assert.equal(payload.notifications[0].title, 'Library scan failed');
  });
});

test('system settings routes reject authenticated non-admin sessions', async () => {
  const app = createSystemRouteTestApp({
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'Administrator access is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'admin_required',
        message: 'Administrator access is required',
      },
    });
  });
});

test('system onboarding route requires a session and returns the shared onboarding checklist payload', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-40', user: { role: 'admin' } }));
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
  const app = createSystemRouteTestApp({ requireAdminSession, buildOnboardingSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/onboarding`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
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
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-41', user: { role: 'admin' } }));
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
  const app = createSystemRouteTestApp({ requireAdminSession, buildLibraryScanSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/system/library-scan-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
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
    requireAdminSession: async () => {
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
    requireFreshAdminSession: async () => ({ appUserId: 'user-30', csrfToken: 'csrf-30', user: { role: 'admin' } }),
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

test('system settings update route preserves forced re-auth failures from the injected admin guard', async () => {
  const app = createSystemRouteTestApp({
    requireFreshAdminSession: async () => {
      throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
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
        code: 'reauth_required',
        message: 'Re-authentication is required before continuing',
      },
    });
  });
});
