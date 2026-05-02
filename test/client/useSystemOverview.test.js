import assert from 'node:assert/strict';
import test from 'node:test';
import { useSystemOverview } from '../../src/client/composables/useSystemOverview.js';

test('useSystemOverview loads overview state and dependency statuses', async (t) => {
  const fetchOverview = t.mock.fn(async () => ({
    artworkMaintenance: {
      checkedAt: '2026-04-30T12:12:00.000Z',
      eligibleAssetCount: 2,
      latestRunId: 'artwork-run-2',
      latestRunStatus: 'failed',
      message: 'The latest artwork cleanup run failed and needs operator review.',
      status: 'failed',
      unassignedAssetCount: 4,
    },
    service: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
      startedAt: '2026-04-30T12:00:00.000Z',
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
        lastTickAt: '2026-04-30T12:04:00.000Z',
        lastTriggeredAt: '2026-04-30T12:04:00.000Z',
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
        lastTickAt: '2026-04-30T12:03:00.000Z',
        lastTriggeredAt: null,
        message: 'No discovery requests are currently due for automatic dispatch.',
        nextRetryAt: null,
        state: {
          lastErrorMessage: null,
          lastOutcome: 'skipped',
          lastSkipReason: 'not_due',
          lastTickAt: '2026-04-30T12:03:00.000Z',
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
        lastTickAt: '2026-04-30T12:04:00.000Z',
        lastTriggeredAt: '2026-04-30T12:04:00.000Z',
        message: 'Import reconciliation most recently persisted import transfer state.',
        nextRetryAt: null,
        state: {
          lastErrorMessage: null,
          lastOutcome: 'started',
          lastSkipReason: null,
          lastTickAt: '2026-04-30T12:04:00.000Z',
          lastTriggeredAt: '2026-04-30T12:04:00.000Z',
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
        lastTickAt: '2026-04-30T12:06:00.000Z',
        lastTriggeredAt: null,
        message: 'MusicBrainz is throttling requests',
        nextRetryAt: '2026-04-30T12:10:00.000Z',
        state: {
          lastErrorMessage: null,
          lastOutcome: 'skipped',
          lastPauseCode: 'musicbrainz_unavailable',
          lastPauseMessage: 'MusicBrainz is throttling requests',
          lastPauseProvider: 'musicbrainz',
          lastSkipReason: 'paused',
          lastTickAt: '2026-04-30T12:06:00.000Z',
          lastTriggeredAt: null,
          nextRetryAt: '2026-04-30T12:10:00.000Z',
        },
        status: 'paused',
      },
    ],
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
        lastTickAt: '2026-04-30T12:06:00.000Z',
        lastTriggeredAt: null,
        nextRetryAt: '2026-04-30T12:10:00.000Z',
      },
    },
    database: {
      name: 'postgresql',
      appliedMigrations: 4,
      pendingMigrations: 0,
    },
    activityFeed: {
      checkedAt: '2026-04-30T12:11:00.000Z',
      entries: [{
        entryType: 'audit',
        id: 'audit:audit-1',
        message: 'Detected new album Sign for Autechre (missing wanted state)',
        occurredAt: '2026-04-30T12:07:00.000Z',
        status: 'info',
        title: 'Metadata detection',
      }],
    },
    dependencies: [{
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      details: {
        retryAfterMs: 2000,
        throttled: true,
      },
      observedAt: '2026-04-30T12:05:00.000Z',
    }],
    paths: [{
      label: 'Music library',
      value: '/data/music',
      description: 'Final managed library root.',
    }],
    pathValidation: {
      checkedAt: '2026-04-30T12:10:00.000Z',
      configuredDownloadMappings: 2,
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
    },
  }));
  const fetchOperatorNotifications = t.mock.fn(async () => ({
    checkedAt: '2026-04-30T12:13:00.000Z',
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
      message: 'Library scan failed',
      occurredAt: '2026-04-30T12:09:00.000Z',
      requiresAction: true,
      severity: 'error',
      title: 'Library scan failed',
    }],
  }));

  const workflow = useSystemOverview({ fetchOverview, fetchOperatorNotifications });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadOverview();

  assert.equal(fetchOverview.mock.callCount(), 1);
  assert.equal(fetchOperatorNotifications.mock.callCount(), 1);
  assert.equal(workflow.isLoading.value, false);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.statusPills.value, [
    { label: 'Service', value: 'harmoniarr' },
    { label: 'Version', value: '0.1.0-beta' },
    { label: 'Discovery cadence', value: '15 minutes' },
    { label: 'Import cadence', value: '10 minutes' },
    { label: 'Metadata cadence', value: '24 hours' },
    { label: 'Pending migrations', value: '0' },
  ]);
  assert.deepEqual(workflow.metadataRefreshSummary.value, {
    intervalLabel: '24 hours',
    isPaused: true,
    lastPauseCode: 'musicbrainz_unavailable',
    lastPauseMessage: 'MusicBrainz is throttling requests',
    lastPauseProvider: 'musicbrainz',
    lastTickAt: '2026-04-30T12:06:00.000Z',
    lastTriggeredAt: null,
    message: 'MusicBrainz is throttling requests',
    nextRetryAt: '2026-04-30T12:10:00.000Z',
    status: 'paused',
    statusClass: 'review-status-held',
  });
  assert.equal(workflow.heartbeatSummaries.value.length, 3);
  assert.equal(workflow.activityFeedCheckedAt.value, '2026-04-30T12:11:00.000Z');
  assert.equal(workflow.hasMoreActivityFeedEntries.value, false);
  assert.deepEqual(workflow.activityFeedEntries.value, [{
    entryType: 'audit',
    id: 'audit:audit-1',
    message: 'Detected new album Sign for Autechre (missing wanted state)',
    occurredAt: '2026-04-30T12:07:00.000Z',
    status: 'info',
    title: 'Metadata detection',
  }]);
  assert.equal(workflow.operatorNotificationCheckedAt.value, '2026-04-30T12:13:00.000Z');
  assert.equal(workflow.operatorNotificationCounts.value.actionable, 1);
  assert.equal(workflow.operatorNotifications.value[0].title, 'Library scan failed');
  assert.deepEqual(workflow.artworkMaintenanceSummary.value, {
    checkedAt: '2026-04-30T12:12:00.000Z',
    eligibleAssetCount: 2,
    latestRunId: 'artwork-run-2',
    latestRunStatus: 'failed',
    message: 'The latest artwork cleanup run failed and needs operator review.',
    status: 'failed',
    unassignedAssetCount: 4,
  });
  assert.deepEqual(workflow.dependencyStatuses.value, [{
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    details: {
      retryAfterMs: 2000,
      throttled: true,
    },
    observedAt: '2026-04-30T12:05:00.000Z',
  }]);
  assert.deepEqual(workflow.pathCards.value, [{
    label: 'Music library',
    value: '/data/music',
    description: 'Final managed library root.',
  }]);
  assert.deepEqual(workflow.pathValidationSummary.value, {
    checkedAt: '2026-04-30T12:10:00.000Z',
    configuredDownloadMappings: 2,
    message: 'Validation needs attention',
    status: 'degraded',
  });
});

test('useSystemOverview surfaces overview load failures', async () => {
  const workflow = useSystemOverview({
    fetchOperatorNotifications: async () => ({
      checkedAt: null,
      counts: {
        actionable: 0,
        byCategory: {
          failure: 0,
          manual_intervention: 0,
          queued_work: 0,
          recovery: 0,
        },
        total: 0,
      },
      notifications: [],
    }),
    fetchOverview: async () => {
      throw new Error('overview unavailable');
    },
  });

  await workflow.loadOverview();

  assert.equal(workflow.isLoading.value, false);
  assert.equal(workflow.errorMessage.value, 'overview unavailable');
  assert.equal(workflow.overview.value, null);
  assert.equal(workflow.artworkMaintenanceSummary.value, null);
  assert.equal(workflow.activityFeedCheckedAt.value, null);
  assert.equal(workflow.metadataRefreshSummary.value, null);
  assert.equal(workflow.operatorNotifications.value.length, 0);
  assert.deepEqual(workflow.statusPills.value, []);
  assert.deepEqual(workflow.activityFeedEntries.value, []);
  assert.deepEqual(workflow.dependencyStatuses.value, []);
  assert.equal(workflow.pathValidationSummary.value, null);
});

test('useSystemOverview appends activity feed pages from the dedicated route', async (t) => {
  const fetchOverview = t.mock.fn(async () => ({
    activityFeed: {
      checkedAt: '2026-04-30T12:11:00.000Z',
      entries: [{
        entryType: 'audit',
        id: 'audit-1',
        message: 'Newest event',
        occurredAt: '2026-04-30T12:07:00.000Z',
        status: 'info',
        title: 'Metadata detection',
      }],
      pageInfo: {
        hasMore: true,
        nextCursor: 'cursor-1',
      },
    },
    database: { pendingMigrations: 0 },
    dependencies: [],
    discoveryHeartbeat: { intervalLabel: '15 minutes' },
    heartbeats: [],
    importExecutionHeartbeat: { intervalLabel: '10 minutes' },
    metadataRefreshHeartbeat: { intervalLabel: '24 hours' },
    paths: [],
    service: { name: 'harmoniarr', version: '0.1.0-beta' },
  }));
  const fetchOperatorNotifications = t.mock.fn(async () => ({
    checkedAt: '2026-04-30T12:13:00.000Z',
    counts: {
      actionable: 0,
      byCategory: {
        failure: 0,
        manual_intervention: 0,
        queued_work: 0,
        recovery: 0,
      },
      total: 0,
    },
    notifications: [],
  }));
  const fetchActivityFeed = t.mock.fn(async ({ before }) => ({
    checkedAt: '2026-04-30T12:15:00.000Z',
    entries: [{
      entryType: 'operation',
      id: 'run-2',
      message: 'Older operation',
      occurredAt: '2026-04-30T12:04:00.000Z',
      status: 'success',
      title: 'Library scan',
    }],
    pageInfo: {
      hasMore: false,
      nextCursor: null,
    },
  }));

  const workflow = useSystemOverview({
    fetchActivityFeed,
    fetchOperatorNotifications,
    fetchOverview,
  });

  await workflow.loadOverview();
  await workflow.loadMoreActivityFeed();

  assert.deepEqual(fetchActivityFeed.mock.calls[0].arguments, [{ before: 'cursor-1' }]);
  assert.equal(fetchOperatorNotifications.mock.callCount(), 1);
  assert.equal(workflow.activityFeedCheckedAt.value, '2026-04-30T12:15:00.000Z');
  assert.equal(workflow.hasMoreActivityFeedEntries.value, false);
  assert.deepEqual(workflow.activityFeedEntries.value, [
    {
      entryType: 'audit',
      id: 'audit-1',
      message: 'Newest event',
      occurredAt: '2026-04-30T12:07:00.000Z',
      status: 'info',
      title: 'Metadata detection',
    },
    {
      entryType: 'operation',
      id: 'run-2',
      message: 'Older operation',
      occurredAt: '2026-04-30T12:04:00.000Z',
      status: 'success',
      title: 'Library scan',
    },
  ]);
  assert.equal(workflow.activityFeedErrorMessage.value, '');
});
