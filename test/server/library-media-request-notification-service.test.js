import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestNotificationService } from '../../src/server/library/library-media-request-notification-service.js';

test('createLibraryMediaRequestNotificationService builds delegated and fulfillment notifications in reverse chronological order', () => {
  const service = createLibraryMediaRequestNotificationService({
    nowFn: () => new Date('2026-05-04T12:30:00.000Z'),
  });

  const payload = service.buildNotifications({
    mediaRequests: [{
      artistName: 'Autechre',
      createdAt: '2026-05-04T10:00:00.000Z',
      fulfillmentStatus: {
        code: 'downloading',
        occurredAt: '2026-05-04T11:00:00.000Z',
      },
      id: 'request-1',
      requestKind: 'release',
      releaseTitle: 'Amber',
      requestedByUser: {
        id: 'admin-1',
        username: 'owner',
      },
      requestedForUser: {
        id: 'user-1',
        username: 'listener',
      },
      updatedAt: '2026-05-04T11:00:00.000Z',
    }, {
      artistName: 'Boards of Canada',
      createdAt: '2026-05-04T09:00:00.000Z',
      fulfillmentStatus: {
        code: 'fulfilled',
        occurredAt: '2026-05-04T12:00:00.000Z',
      },
      id: 'request-2',
      requestKind: 'release',
      releaseTitle: 'Music Has the Right to Children',
      requestedByUser: {
        id: 'user-2',
        username: 'listener-2',
      },
      requestedForUser: {
        id: 'user-2',
        username: 'listener-2',
      },
      updatedAt: '2026-05-04T12:00:00.000Z',
    }],
  });

  assert.equal(payload.checkedAt, '2026-05-04T12:30:00.000Z');
  assert.equal(payload.counts.total, 3);
  assert.equal(payload.counts.byCategory.delegated_request, 1);
  assert.equal(payload.counts.byCategory.fulfillment, 2);
  assert.equal(payload.notifications[0].title, 'Request fulfilled');
  assert.equal(payload.notifications[1].title, 'Download in progress');
  assert.equal(payload.notifications[2].title, 'Music requested for you');
});

test('createLibraryMediaRequestNotificationService enforces limits and includes failures', () => {
  const service = createLibraryMediaRequestNotificationService();

  const payload = service.buildNotifications({
    limit: 1,
    mediaRequests: [{
      artistName: 'Daft Punk',
      createdAt: '2026-05-04T08:00:00.000Z',
      fulfillmentStatus: {
        code: 'failed',
        occurredAt: '2026-05-04T09:00:00.000Z',
      },
      id: 'request-3',
      requestKind: 'release',
      releaseTitle: 'Discovery',
      requestedByUser: {
        id: 'admin-1',
        username: 'owner',
      },
      requestedForUser: {
        id: 'user-3',
        username: 'listener-3',
      },
    }],
  });

  assert.equal(payload.notifications.length, 1);
  assert.equal(payload.counts.total, 1);
  assert.equal(payload.counts.byCategory.failure, 1);
  assert.equal(payload.notifications[0].severity, 'error');
});
