import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryHeartbeatState } from '../../src/server/library/library-discovery-heartbeat-state.js';
import { createLibraryDiscoverySummaryService } from '../../src/server/library/library-discovery-summary-service.js';

test('buildLibraryDiscoverySummary reports empty state when no requests exist', async () => {
  const libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState();
  const service = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    libraryDiscoveryHeartbeatState,
    libraryDiscoveryRunStore: {
      getLatestRun: async () => null,
    },
    libraryDiscoverySummaryStore: {
      getLibraryDiscoverySnapshot: async () => ({
        lastEvaluatedAt: null,
        nextEligibleAt: null,
        requestCounts: {
          blocked: 0,
          cooldown: 0,
          ready: 0,
          totalRequests: 0,
        },
      }),
    },
  });

  const summary = await service.buildLibraryDiscoverySummary();

  assert.equal(summary.heartbeat.intervalLabel, '15 minutes');
  assert.equal(summary.heartbeat.state.lastOutcome, null);
  assert.equal(summary.latestRun, null);
  assert.equal(summary.summary.status, 'empty');
  assert.equal(summary.summary.message, 'No discovery requests are queued from current wanted releases yet.');
});

test('buildLibraryDiscoverySummary reports ready state when any request can search now', async () => {
  const libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState();
  libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
    occurredAt: '2026-04-30T14:10:00.000Z',
    outcome: 'skipped',
    skipReason: 'not_due',
  });
  const service = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '30 minutes',
      intervalMs: 1800000,
      mode: 'automatic',
      source: 'environment',
    },
    libraryDiscoveryHeartbeatState,
    libraryDiscoveryRunStore: {
      getLatestRun: async () => ({
        candidateCount: 7,
        dispatchedCount: 3,
        id: 'run-2',
        status: 'completed',
        triggerSource: 'heartbeat',
      }),
    },
    libraryDiscoverySummaryStore: {
      getLibraryDiscoverySnapshot: async () => ({
        lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
        nextEligibleAt: '2026-04-30T18:00:00.000Z',
        requestCounts: {
          blocked: 1,
          cooldown: 2,
          ready: 3,
          totalRequests: 6,
        },
      }),
    },
  });

  const summary = await service.buildLibraryDiscoverySummary();

  assert.equal(summary.heartbeat.source, 'environment');
  assert.equal(summary.heartbeat.state.lastSkipReason, 'not_due');
  assert.equal(summary.latestRun.id, 'run-2');
  assert.equal(summary.latestRun.triggerSource, 'heartbeat');
  assert.equal(summary.summary.status, 'ready');
  assert.equal(summary.summary.message, '3 discovery requests are ready to search now.');
});

test('buildLibraryDiscoverySummary uses singular copy for one ready request', async () => {
  const service = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatState: createLibraryDiscoveryHeartbeatState(),
    libraryDiscoveryRunStore: {
      getLatestRun: async () => null,
    },
    libraryDiscoverySummaryStore: {
      getLibraryDiscoverySnapshot: async () => ({
        lastEvaluatedAt: null,
        nextEligibleAt: null,
        requestCounts: {
          blocked: 0,
          cooldown: 0,
          ready: 1,
          totalRequests: 1,
        },
      }),
    },
  });

  const summary = await service.buildLibraryDiscoverySummary();

  assert.equal(summary.summary.status, 'ready');
  assert.equal(summary.summary.message, '1 discovery request is ready to search now.');
});

test('buildLibraryDiscoverySummary reports cooldown state before date-blocked state', async () => {
  const libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState();
  const service = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    libraryDiscoveryHeartbeatState,
    libraryDiscoveryRunStore: {
      getLatestRun: async () => null,
    },
    libraryDiscoverySummaryStore: {
      getLibraryDiscoverySnapshot: async () => ({
        lastEvaluatedAt: '2026-04-30T14:00:00.000Z',
        nextEligibleAt: '2026-04-30T18:00:00.000Z',
        requestCounts: {
          blocked: 2,
          cooldown: 1,
          ready: 0,
          totalRequests: 3,
        },
      }),
    },
  });

  const summary = await service.buildLibraryDiscoverySummary();

  assert.equal(summary.summary.status, 'cooldown');
  assert.equal(summary.summary.message, '1 discovery request is waiting for automatic cooldown expiry.');
});

test('buildLibraryDiscoverySummary returns exact historical run detail when requested', async (t) => {
  const service = createLibraryDiscoverySummaryService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    libraryDiscoveryHeartbeatState: createLibraryDiscoveryHeartbeatState(),
    libraryDiscoveryRunStore: {
      getRunById: t.mock.fn(async () => ({
        candidateCount: 7,
        dispatchedCount: 3,
        id: 'run-12',
        status: 'failed',
        triggerSource: 'manual',
      })),
    },
    libraryDiscoverySummaryStore: {
      getLibraryDiscoverySnapshot: async () => ({
        lastEvaluatedAt: null,
        nextEligibleAt: null,
        requestCounts: {
          blocked: 0,
          cooldown: 0,
          ready: 0,
          totalRequests: 0,
        },
      }),
    },
  });

  const payload = await service.buildLibraryDiscoveryRunDetail({ runId: 'run-12' });

  assert.equal(payload.run.id, 'run-12');
  assert.equal(payload.run.dispatchedCount, 3);
  assert.equal(payload.run.triggerSource, 'manual');
});
