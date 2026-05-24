import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorNotificationService } from '../../src/server/operator-notification-service.js';

test('createOperatorNotificationService classifies queued work, failures, recoveries, and manual-intervention needs', () => {
  const service = createOperatorNotificationService({
    nowFn: () => new Date('2026-05-02T16:00:00.000Z'),
  });

  const payload = service.buildOperatorNotifications({
    heartbeats: [{
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastTickAt: '2026-05-02T15:55:00.000Z',
      message: 'MusicBrainz is throttling requests',
      status: 'paused',
    }],
    operationRuns: [{
      id: 'run-pending-1',
      operationType: 'library_scan',
      startedAt: '2026-05-02T15:40:00.000Z',
      status: 'pending',
    }, {
      errorMessage: 'Import apply failed due to target collision.',
      id: 'run-failed-1',
      operationType: 'import_candidate_apply',
      startedAt: '2026-05-02T15:45:00.000Z',
      status: 'failed',
    }, {
      attemptCount: 2,
      finishedAt: '2026-05-02T15:58:00.000Z',
      id: 'run-recovered-1',
      operationType: 'metadata_artist_refresh',
      startedAt: '2026-05-02T15:50:00.000Z',
      status: 'completed',
    }],
  });

  assert.equal(payload.checkedAt, '2026-05-02T16:00:00.000Z');
  assert.equal(payload.counts.total, 4);
  assert.equal(payload.counts.actionable, 2);
  assert.equal(payload.counts.byCategory.queued_work, 1);
  assert.equal(payload.counts.byCategory.failure, 1);
  assert.equal(payload.counts.byCategory.recovery, 1);
  assert.equal(payload.counts.byCategory.manual_intervention, 1);
  assert.equal(payload.notifications[0].category, 'recovery');
  assert.equal(payload.notifications[0].severity, 'success');
  assert.equal(payload.notifications[1].category, 'manual_intervention');
  assert.equal(payload.notifications[1].requiresAction, true);
  assert.equal(payload.notifications[2].category, 'failure');
  assert.equal(payload.notifications[2].message, 'Import apply failed due to target collision.');
});

test('createOperatorNotificationService deduplicates notifications and enforces limits', () => {
  const service = createOperatorNotificationService();

  const payload = service.buildOperatorNotifications({
    heartbeats: [{
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastTickAt: '2026-05-02T15:55:00.000Z',
      message: 'MusicBrainz is throttling requests',
      status: 'paused',
    }, {
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastTickAt: '2026-05-02T15:54:00.000Z',
      message: 'MusicBrainz is still throttling requests',
      status: 'paused',
    }],
    limit: 1,
    operationRuns: [{
      id: 'run-failed-1',
      operationType: 'import_candidate_apply',
      startedAt: '2026-05-02T15:45:00.000Z',
      status: 'failed',
    }],
  });

  assert.equal(payload.notifications.length, 1);
  assert.equal(payload.counts.total, 1);
});

test('buildOperatorNotifications marks notifications as acknowledged when occurredAt <= acknowledgedBefore', () => {
  const service = createOperatorNotificationService({
    nowFn: () => new Date('2026-05-02T16:00:00.000Z'),
  });

  const payload = service.buildOperatorNotifications({
    acknowledgedBefore: '2026-05-02T15:50:00.000Z',
    operationRuns: [{
      id: 'run-old',
      operationType: 'library_scan',
      startedAt: '2026-05-02T15:40:00.000Z',
      status: 'failed',
    }, {
      id: 'run-new',
      operationType: 'metadata_artist_refresh',
      startedAt: '2026-05-02T15:55:00.000Z',
      status: 'failed',
    }],
  });

  assert.equal(payload.notifications.length, 2);
  assert.equal(payload.notifications[0].isAcknowledged, false, 'newer notification is unacknowledged');
  assert.equal(payload.notifications[1].isAcknowledged, true, 'older notification is acknowledged');
  assert.equal(payload.counts.unacknowledged, 1);
  assert.equal(payload.counts.total, 2);
});

test('buildOperatorNotifications sets all notifications unacknowledged when no acknowledgedBefore', () => {
  const service = createOperatorNotificationService();

  const payload = service.buildOperatorNotifications({
    operationRuns: [{
      id: 'run-1',
      operationType: 'library_scan',
      startedAt: '2026-05-02T15:40:00.000Z',
      status: 'failed',
    }],
  });

  assert.equal(payload.notifications[0].isAcknowledged, false);
  assert.equal(payload.counts.unacknowledged, 1);
});

test('buildOperatorNotifications marks heartbeat notifications as acknowledged', () => {
  const service = createOperatorNotificationService();

  const payload = service.buildOperatorNotifications({
    acknowledgedBefore: '2026-05-02T15:55:00.000Z',
    heartbeats: [{
      key: 'metadataRefresh',
      label: 'Metadata refresh',
      lastTickAt: '2026-05-02T15:50:00.000Z',
      message: 'Paused',
      status: 'paused',
    }],
  });

  assert.equal(payload.notifications[0].isAcknowledged, true);
  assert.equal(payload.counts.unacknowledged, 0);
});