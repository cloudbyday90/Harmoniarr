import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemService } from '../../src/server/system-service.js';

test('createSystemService reuses shared settings validation and configured paths in overview payloads', async (t) => {
  const artworkPolicyService = {
    buildArtworkOverviewFromSettingsPayload: t.mock.fn((settingsPayload) => ({
      fetch: {
        enabled: settingsPayload.settings.artwork.fetchEnabled,
        providerOrder: settingsPayload.settings.artwork.providerOrder,
        refetchMissingAutomatically: settingsPayload.settings.artwork.refetchMissingAutomatically,
      },
    })),
  };
  const artworkSummaryService = {
    buildArtworkSummary: t.mock.fn(async () => ({
      checkedAt: '2026-04-30T22:00:00.000Z',
      inventory: {
        eligibleAssetCount: 2,
        unassignedAssetCount: 4,
      },
      latestRun: {
        id: 'artwork-run-4',
        status: 'failed',
      },
      summary: {
        status: 'failed',
        message: 'The latest artwork cleanup run failed and needs operator review.',
      },
    })),
  };
  const dependencyHealthService = {
    getDependencyHealth: t.mock.fn(async () => [{
      provider: 'musicbrainz',
      status: 'healthy',
      observedAt: '2026-04-30T20:00:00.000Z',
    }]),
  };
  const settingsService = {
    buildSettingsPayload: t.mock.fn(async () => ({
      settings: {
        artwork: {
          fetchEnabled: true,
          providerOrder: ['coverArtArchive'],
          refetchMissingAutomatically: false,
        },
        paths: {
          downloadMappings: [{
            slskdPrefix: '/downloads/completed',
            harmoniarrPrefix: '/srv/downloads/completed',
          }],
          downloads: '/srv/downloads',
          music: '/srv/music',
          staging: '/srv/staging',
          transcodeTemp: '/srv/transcode',
        },
      },
      pathValidation: {
        checkedAt: '2026-04-30T21:00:00.000Z',
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
    })),
  };
  const activityFeedService = {
    buildRecentActivityFeed: t.mock.fn(async () => ({
      checkedAt: '2026-04-30T22:30:00.000Z',
      entries: [{
        entryType: 'audit',
        id: 'audit:audit-1',
        message: 'Detected new album Sign for Autechre (missing wanted state)',
        occurredAt: '2026-04-30T20:06:00.000Z',
        status: 'info',
        title: 'Metadata detection',
      }],
    })),
  };
  const pool = {
    query: t.mock.fn(async () => ({ rows: [{ name: 'harmoniarr_test' }] })),
  };
  const systemService = createSystemService({
    activityFeedService,
    artworkPolicyService,
    artworkSummaryService,
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    metadataRefreshHeartbeatConfig: {
      intervalLabel: '24 hours',
      intervalMs: 86400000,
      mode: 'automatic',
      source: 'default',
    },
    metadataRefreshHeartbeatState: {
      getHeartbeatState: () => ({
        lastErrorMessage: null,
        lastOutcome: 'skipped',
        lastPauseCode: 'musicbrainz_unavailable',
        lastPauseMessage: 'MusicBrainz is throttling requests',
        lastPauseProvider: 'musicbrainz',
        lastSkipReason: 'paused',
        lastTickAt: '2026-04-30T20:05:00.000Z',
        lastTriggeredAt: null,
        nextRetryAt: '2026-04-30T20:10:00.000Z',
      }),
    },
    startedAt: new Date('2026-04-30T18:00:00.000Z'),
    packageJsonPath: 'ignored-for-test',
    dependencyHealthService,
    getMigrationStatusFn: async () => ({ applied: 4, pending: ['20260430_add_paths.sql'] }),
    getPoolFn: () => pool,
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    settingsService,
  });

  const overview = await systemService.getOverview({ includeDependencies: true });

  assert.equal(settingsService.buildSettingsPayload.mock.callCount(), 1);
  assert.equal(artworkPolicyService.buildArtworkOverviewFromSettingsPayload.mock.callCount(), 1);
  assert.equal(artworkSummaryService.buildArtworkSummary.mock.callCount(), 1);
  assert.equal(dependencyHealthService.getDependencyHealth.mock.callCount(), 1);
  assert.equal(activityFeedService.buildRecentActivityFeed.mock.callCount(), 1);
  assert.equal(pool.query.mock.callCount(), 1);
  assert.deepEqual(overview.artwork, {
    fetch: {
      enabled: true,
      providerOrder: ['coverArtArchive'],
      refetchMissingAutomatically: false,
    },
  });
  assert.deepEqual(overview.artworkMaintenance, {
    checkedAt: '2026-04-30T22:00:00.000Z',
    eligibleAssetCount: 2,
    latestRunId: 'artwork-run-4',
    latestRunStatus: 'failed',
    message: 'The latest artwork cleanup run failed and needs operator review.',
    status: 'failed',
    unassignedAssetCount: 4,
  });
  assert.deepEqual(overview.discoveryHeartbeat, {
    intervalLabel: '15 minutes',
    intervalMs: 900000,
    mode: 'automatic',
    source: 'default',
  });
  assert.deepEqual(overview.metadataRefreshHeartbeat, {
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
  });
  assert.deepEqual(overview.heartbeats, [
    {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      key: 'libraryDiscovery',
      label: 'Discovery dispatch',
      lastErrorMessage: null,
      lastPauseProvider: null,
      lastSkipReason: null,
      lastTickAt: null,
      lastTriggeredAt: null,
      message: 'Discovery dispatch has not recorded a heartbeat outcome yet.',
      mode: 'automatic',
      nextRetryAt: null,
      source: 'default',
      state: null,
      status: 'waiting',
    },
    {
      intervalLabel: '24 hours',
      intervalMs: 86400000,
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastErrorMessage: null,
      lastPauseProvider: 'musicbrainz',
      lastSkipReason: 'paused',
      lastTickAt: '2026-04-30T20:05:00.000Z',
      lastTriggeredAt: null,
      message: 'MusicBrainz is throttling requests',
      mode: 'automatic',
      nextRetryAt: '2026-04-30T20:10:00.000Z',
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
      status: 'paused',
    },
  ]);
  assert.deepEqual(overview.pathValidation, {
    checkedAt: '2026-04-30T21:00:00.000Z',
    configuredDownloadMappings: 1,
    summary: {
      status: 'degraded',
      message: 'Validation needs attention',
    },
  });
  assert.deepEqual(overview.activityFeed, {
    checkedAt: '2026-04-30T22:30:00.000Z',
    entries: [{
      entryType: 'audit',
      id: 'audit:audit-1',
      message: 'Detected new album Sign for Autechre (missing wanted state)',
      occurredAt: '2026-04-30T20:06:00.000Z',
      status: 'info',
      title: 'Metadata detection',
    }],
  });
  assert.equal(overview.runtime, null);
  assert.equal(overview.paths.find((entry) => entry.label === 'Downloads').value, '/srv/downloads');
  assert.equal(overview.paths.find((entry) => entry.label === 'Music library').value, '/srv/music');
});

test('createSystemService can omit dependency checks while preserving validation summary', async (t) => {
  const artworkPolicyService = {
    buildArtworkOverviewFromSettingsPayload: t.mock.fn(() => ({
      fetch: {
        enabled: false,
        providerOrder: ['coverArtArchive'],
        refetchMissingAutomatically: false,
      },
    })),
  };
  const artworkSummaryService = {
    buildArtworkSummary: t.mock.fn(async () => ({
      checkedAt: '2026-04-30T22:10:00.000Z',
      inventory: {
        eligibleAssetCount: 0,
        unassignedAssetCount: 1,
      },
      latestRun: null,
      summary: {
        status: 'waiting',
        message: '1 unassigned artwork asset is being retained until the cleanup cutoff is reached.',
      },
    })),
  };
  const dependencyHealthService = {
    getDependencyHealth: t.mock.fn(async () => []),
  };
  const systemService = createSystemService({
    artworkPolicyService,
    artworkSummaryService,
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '30 minutes',
      intervalMs: 1800000,
      mode: 'automatic',
      source: 'environment',
    },
    startedAt: new Date('2026-04-30T18:00:00.000Z'),
    packageJsonPath: 'ignored-for-test',
    dependencyHealthService,
    getMigrationStatusFn: async () => ({ applied: 2, pending: [] }),
    getPoolFn: () => ({ query: async () => ({ rows: [{ name: 'harmoniarr_test' }] }) }),
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: { paths: {} },
        pathValidation: {
          checkedAt: '2026-04-30T21:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  const overview = await systemService.getOverview({ includeDependencies: false });

  assert.equal(dependencyHealthService.getDependencyHealth.mock.callCount(), 0);
  assert.equal(artworkPolicyService.buildArtworkOverviewFromSettingsPayload.mock.callCount(), 1);
  assert.equal(artworkSummaryService.buildArtworkSummary.mock.callCount(), 0);
  assert.deepEqual(overview.dependencies, []);
  assert.equal(overview.activityFeed.entries.length, 0);
  assert.deepEqual(overview.artwork, {
    fetch: {
      enabled: false,
      providerOrder: ['coverArtArchive'],
      refetchMissingAutomatically: false,
    },
  });
  assert.equal(overview.artworkMaintenance, null);
  assert.equal(overview.discoveryHeartbeat.intervalLabel, '30 minutes');
  assert.equal(overview.metadataRefreshHeartbeat, null);
  assert.equal(overview.pathValidation.summary.status, 'healthy');
  assert.equal(overview.runtime, null);
});

test('createSystemService builds operator notifications from shared operation and heartbeat state', async (t) => {
  const operationHistoryService = {
    listRecentOperationRuns: t.mock.fn(async () => ([{
      id: 'run-failed-1',
      operationType: 'library_scan',
      startedAt: '2026-05-02T15:45:00.000Z',
      status: 'failed',
    }])),
  };
  const operatorNotificationService = {
    buildOperatorNotifications: t.mock.fn(() => ({
      checkedAt: '2026-05-02T16:00:00.000Z',
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
        id: 'run:run-failed-1:failure',
        message: 'Library scan failed',
        occurredAt: '2026-05-02T15:45:00.000Z',
        requiresAction: true,
        severity: 'error',
        title: 'Library scan failed',
      }],
    })),
  };

  const systemService = createSystemService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    metadataRefreshHeartbeatConfig: {
      intervalLabel: '24 hours',
      intervalMs: 86400000,
      mode: 'automatic',
      source: 'default',
    },
    metadataRefreshHeartbeatState: {
      getHeartbeatState: () => ({
        lastOutcome: 'skipped',
        lastPauseMessage: 'MusicBrainz is throttling requests',
        lastPauseProvider: 'musicbrainz',
        lastSkipReason: 'paused',
        lastTickAt: '2026-05-02T15:55:00.000Z',
      }),
    },
    operationHistoryService,
    operatorNotificationService,
  });

  const notifications = await systemService.getOperatorNotifications({ limit: 10 });

  assert.equal(operationHistoryService.listRecentOperationRuns.mock.callCount(), 1);
  assert.deepEqual(operationHistoryService.listRecentOperationRuns.mock.calls[0].arguments, [{ limit: 20 }]);
  assert.equal(operatorNotificationService.buildOperatorNotifications.mock.callCount(), 1);
  assert.equal(notifications.counts.total, 1);
});

test('createSystemService returns an empty notification payload when no shared notification service is configured', async (t) => {
  const operationHistoryService = {
    listRecentOperationRuns: t.mock.fn(async () => []),
  };

  const systemService = createSystemService({
    operationHistoryService,
    operatorNotificationService: null,
  });

  const notifications = await systemService.getOperatorNotifications({ limit: 10 });

  assert.equal(operationHistoryService.listRecentOperationRuns.mock.callCount(), 1);
  assert.equal(notifications.counts.total, 0);
  assert.deepEqual(notifications.notifications, []);
});

test('createSystemService forwards discovery setup-required heartbeat state', async (t) => {
  const operatorNotificationService = {
    buildOperatorNotifications: t.mock.fn(({ heartbeats }) => ({
      checkedAt: '2026-05-02T16:00:00.000Z',
      counts: {
        actionable: 0,
        byCategory: {
          failure: 0,
          manual_intervention: 0,
          queued_work: 0,
          recovery: 0,
        },
        total: 0,
        unacknowledged: 0,
      },
      heartbeats,
      notifications: [],
    })),
  };
  const systemService = createSystemService({
    libraryDiscoveryHeartbeatState: {
      getHeartbeatState: () => ({
        lastOutcome: 'skipped',
        lastPauseCode: 'slskd_not_configured',
        lastPauseMessage: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
        lastPauseProvider: 'slskd',
        lastSkipReason: 'setup_required',
        lastTickAt: '2026-05-02T15:55:00.000Z',
      }),
    },
    operationHistoryService: {
      listRecentOperationRuns: t.mock.fn(async () => []),
    },
    operatorNotificationService,
  });

  const notifications = await systemService.getOperatorNotifications({ limit: 10 });

  assert.equal(operatorNotificationService.buildOperatorNotifications.mock.callCount(), 1);
  assert.equal(notifications.notifications.length, 0);
  assert.equal(notifications.heartbeats[0].key, 'libraryDiscovery');
  assert.equal(notifications.heartbeats[0].status, 'setup_required');
  assert.equal(
    notifications.heartbeats[0].message,
    'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
  );
});

test('createSystemService includes runtime monitoring details in the overview payload when configured', async () => {
  const runtimeResourceService = {
    getRuntimeConfiguration() {
      return {
        mediaCommands: {
          defaultKillGraceMs: 5000,
          defaultMaxBufferBytes: 2097152,
          defaultTimeoutMs: 30000,
          ffmpegThreads: 4,
        },
        processMonitoring: {
          heartbeatStaleMultiplier: 3,
          heapUsedWarnBytes: 134217728,
          intervalMs: 60000,
          rssWarnBytes: 536870912,
        },
      };
    },
  };
  const runtimeResourceMonitor = {
    getRuntimeState() {
      return {
        latestSample: {
          capturedAt: '2026-05-03T12:00:00.000Z',
          memory: {
            heapUsedBytes: 33554432,
            rssBytes: 100663296,
          },
        },
        message: 'Runtime monitoring has not detected resource pressure or stale worker heartbeats.',
        status: 'healthy',
        warnings: [],
      };
    },
  };
  const systemService = createSystemService({
    dependencyHealthService: {
      getDependencyHealth: async () => [],
    },
    getMigrationStatusFn: async () => ({ applied: 1, pending: [] }),
    getPoolFn: () => ({ query: async () => ({ rows: [{ name: 'harmoniarr_test' }] }) }),
    packageJsonPath: 'ignored-for-test',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    runtimeResourceMonitor,
    runtimeResourceService,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {},
        },
      }),
    },
    startedAt: new Date('2026-05-03T11:00:00.000Z'),
  });

  const overview = await systemService.getOverview({ includeDependencies: false });

  assert.deepEqual(overview.runtime, {
    configuration: runtimeResourceService.getRuntimeConfiguration(),
    latestSample: {
      capturedAt: '2026-05-03T12:00:00.000Z',
      memory: {
        heapUsedBytes: 33554432,
        rssBytes: 100663296,
      },
    },
    message: 'Runtime monitoring has not detected resource pressure or stale worker heartbeats.',
    status: 'healthy',
    warnings: [],
  });
});
