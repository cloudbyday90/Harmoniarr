import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityFeedService } from '../../src/server/activity-feed-service.js';

test('activity feed service merges audit, operation, and heartbeat activity in descending time order', async (t) => {
  const service = createActivityFeedService({
    auditReadService: {
      listRecentAuditEvents: t.mock.fn(async () => [{
        eventType: 'metadata_release_group_detected',
        id: 'audit-1',
        occurredAt: '2026-05-02T12:07:00.000Z',
        summary: 'Detected new album Sign for Autechre (missing wanted state)',
      }]),
    },
    nowFn: () => new Date('2026-05-02T12:10:00.000Z'),
    operationHistoryService: {
      listRecentOperationRuns: t.mock.fn(async () => [{
        cancelledAt: null,
        errorMessage: null,
        finishedAt: '2026-05-02T12:08:00.000Z',
        id: 'run-1',
        operationType: 'metadata_artist_refresh',
        startedAt: '2026-05-02T12:06:00.000Z',
        status: 'completed',
        summary: {
          currentStep: 'Persisted artist metadata',
        },
      }]),
    },
  });

  const feed = await service.buildRecentActivityFeed({
    heartbeats: [{
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastTickAt: '2026-05-02T12:09:00.000Z',
      message: 'Metadata refresh dispatch is paused.',
      status: 'paused',
    }],
  });

  assert.equal(feed.checkedAt, '2026-05-02T12:10:00.000Z');
  assert.deepEqual(feed.entries.map((entry) => entry.entryType), ['heartbeat', 'operation_run', 'audit']);
  assert.deepEqual(feed.entries[0], {
    entryType: 'heartbeat',
    id: 'heartbeat:metadataRefresh:2026-05-02T12:09:00.000Z',
    message: 'Metadata refresh dispatch is paused.',
    occurredAt: '2026-05-02T12:09:00.000Z',
    status: 'error',
    title: 'Metadata refresh',
  });
});