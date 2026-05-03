import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiagnosticsExportService } from '../../src/server/diagnostics-export-service.js';

test('diagnostics export service builds a compact redacted diagnostics bundle and attachment payload', async () => {
  const service = createDiagnosticsExportService({
    getOperatorNotifications: async ({ limit }) => ({
      checkedAt: '2026-05-03T13:03:00.000Z',
      counts: {
        actionable: 1,
        byCategory: {
          failure: 1,
        },
        total: 1,
      },
      notifications: [{
        category: 'failure',
        id: 'notification-1',
        message: 'Run failed for ops@example.com at /mnt/music/library',
        occurredAt: '2026-05-03T13:02:00.000Z',
        requiresAction: true,
        severity: 'error',
        title: `Notifications ${limit}`,
      }],
    }),
    getOverview: async ({ activityFeedLimit, includeDependencies }) => ({
      activityFeed: {
        checkedAt: '2026-05-03T13:01:00.000Z',
        entries: [{
          entryType: 'operation_run',
          id: 'run:run-1',
          message: 'Import failed while reading /app/data/staging/tmp-1 for admin@example.com',
          occurredAt: '2026-05-03T13:00:00.000Z',
          operationType: 'import_candidate_apply',
          runId: 'run-1',
          status: 'error',
          title: 'Import apply',
        }],
        pageInfo: {
          hasMore: false,
          nextCursor: null,
        },
      },
      artworkMaintenance: null,
      database: {
        name: 'harmoniarr_test',
        pendingMigrations: 0,
      },
      dependencies: [{
        details: {
          url: 'https://musicbrainz.example/ws/2',
        },
        message: 'MusicBrainz retrying for ops@example.com',
        observedAt: '2026-05-03T12:59:00.000Z',
        provider: 'musicbrainz',
        status: 'degraded',
      }],
      heartbeats: [{
        key: 'metadataRefresh',
        label: 'Metadata refresh',
        message: 'Metadata refresh is paused for ops@example.com at /srv/music',
        status: 'paused',
      }],
      includeDependencies,
      pathValidation: {
        checkedAt: '2026-05-03T13:00:30.000Z',
        configuredDownloadMappings: 1,
        summary: {
          message: 'Validation needs attention',
          status: 'degraded',
        },
      },
      runtime: {
        configuration: {
          mediaCommands: {
            ffmpegThreads: 4,
          },
          processMonitoring: {
            intervalMs: 60000,
          },
          threading: {
            availableParallelism: 8,
          },
        },
        latestSample: {
          capturedAt: '2026-05-03T13:03:30.000Z',
        },
        message: 'Runtime warning for /app/data/cache and admin@example.com',
        status: 'warning',
        warnings: [{
          code: 'runtime_rss_threshold_exceeded',
          message: 'Process RSS exceeded threshold at /app/data/cache',
        }],
      },
      service: {
        name: 'harmoniarr',
        startedAt: '2026-05-03T12:00:00.000Z',
        version: '0.1.0-beta',
      },
      source: {
        activityFeedLimit,
      },
    }),
    getQueueDiagnostics: async ({ runLimit }) => ({
      checkedAt: '2026-05-03T13:04:00.000Z',
      queueState: {
        failed: 1,
        pending: 2,
        running: 0,
        totalTracked: 3,
      },
      recentRuns: [{
        errorMessage: 'failed in /mnt/music/library for admin@example.com',
        finishedAt: '2026-05-03T13:03:00.000Z',
        id: 'run-queue-1',
        operationType: 'library_scan',
        startedAt: '2026-05-03T13:00:00.000Z',
        status: 'failed',
        summary: {
          currentStep: 'Scanning /mnt/music/library',
        },
        triggeredByUserId: 'admin-1',
      }],
      runLimit,
    }),
    getRecoveryDiagnostics: async ({ auditLimit, lockTypes, runLimit }) => ({
      checkedAt: '2026-05-03T13:05:00.000Z',
      maintenance: {
        activeLocks: [{
          id: 'lock-1',
          lockType: 'maintenance',
          reason: 'Inspect [REDACTED_PATH]',
        }],
        hasActiveLocks: true,
        lockCount: 1,
        lockTypes,
      },
      recentFailedRuns: [],
      recentPrivilegedActions: [{
        eventType: 'maintenance_lock_entered',
        id: 'audit-1',
      }],
      source: {
        auditLimit,
        runLimit,
      },
    }),
    nowFn: () => new Date('2026-05-03T13:06:00.000Z'),
  });

  const exportPayload = await service.buildDiagnosticsExport({
    activityLimit: 15,
    auditLimit: 9,
    lockTypes: ['maintenance', 'restore'],
    notificationLimit: 7,
    runLimit: 11,
  });

  assert.equal(exportPayload.exportType, 'system_diagnostics');
  assert.equal(exportPayload.source.activityLimit, 15);
  assert.equal(exportPayload.source.notificationLimit, 7);
  assert.equal(exportPayload.diagnostics.overview.dependencies[0].message, 'MusicBrainz retrying for [REDACTED_EMAIL]');
  assert.equal(exportPayload.diagnostics.overview.heartbeats[0].message, 'Metadata refresh is paused for [REDACTED_EMAIL] at [REDACTED_PATH]');
  assert.equal(exportPayload.diagnostics.overview.runtime.message, 'Runtime warning for [REDACTED_PATH] and [REDACTED_EMAIL]');
  assert.equal(exportPayload.diagnostics.overview.runtime.warnings[0].message, 'Process RSS exceeded threshold at [REDACTED_PATH]');
  assert.equal(exportPayload.diagnostics.activityFeed.entries[0].message, 'Import failed while reading [REDACTED_PATH] for [REDACTED_EMAIL]');
  assert.equal(exportPayload.diagnostics.operatorNotifications.notifications[0].message, 'Run failed for [REDACTED_EMAIL] at [REDACTED_PATH]');
  assert.equal(exportPayload.diagnostics.queue.recentRuns[0].errorMessage, 'failed in [REDACTED_PATH] for [REDACTED_EMAIL]');
  assert.deepEqual(exportPayload.diagnostics.queue.recentRuns[0].summary, {
    currentStep: 'Scanning [REDACTED_PATH]',
  });
  assert.equal(exportPayload.diagnostics.recovery.maintenance.activeLocks[0].reason, 'Inspect [REDACTED_PATH]');
  assert.equal(Object.hasOwn(exportPayload.diagnostics.overview, 'paths'), false);

  const download = await service.getDiagnosticsExportDownload({
    activityLimit: 15,
    auditLimit: 9,
    lockTypes: ['maintenance', 'restore'],
    notificationLimit: 7,
    runLimit: 11,
  });

  assert.equal(download.contentType, 'application/json; charset=utf-8');
  assert.match(download.filename, /^harmoniarr_diagnostics_2026-05-03T13-06-00-000Z\.json$/);
  assert.match(download.content.toString('utf8'), /"exportType": "system_diagnostics"/);
});
