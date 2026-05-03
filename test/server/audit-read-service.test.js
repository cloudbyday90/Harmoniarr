import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditReadService } from '../../src/server/audit-read-service.js';

test('audit read service returns normalized recent events for one actor', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      entity_id: 'run-22',
      entity_type: 'operation_run',
      event_type: 'artwork_cleanup_started',
      id: 'audit-1',
      occurred_at: '2026-05-01T16:10:00.000Z',
      summary: 'Artwork cleanup started',
    }],
  }));
  const service = createAuditReadService({
    getPoolFn: () => ({ query }),
  });

  const events = await service.listRecentAuditEvents({
    actorUserId: 'user-1',
    limit: 5,
  });

  assert.equal(query.mock.callCount(), 1);
  assert.equal(query.mock.calls[0].arguments[1][0], 'user-1');
  assert.equal(query.mock.calls[0].arguments[1][1], 5);
  assert.deepEqual(events, [{
    details: {},
    entityId: 'run-22',
    entityType: 'operation_run',
    eventType: 'artwork_cleanup_started',
    id: 'audit-1',
    occurredAt: '2026-05-01T16:10:00.000Z',
    summary: 'Artwork cleanup started',
  }]);
});

test('audit read service clamps invalid limits to the shared default window', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const service = createAuditReadService({
    getPoolFn: () => ({ query }),
  });

  await service.listRecentAuditEvents({
    actorUserId: 'user-1',
    limit: 'invalid',
  });

  assert.equal(query.mock.calls[0].arguments[1][1], 10);
});

test('audit read service can list events for one entity timeline', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      entity_id: 'run-77',
      entity_type: 'operation_run',
      event_type: 'library_scan_started',
      id: 'audit-77',
      occurred_at: '2026-05-01T16:20:00.000Z',
      summary: 'Library scan started',
    }],
  }));
  const service = createAuditReadService({
    getPoolFn: () => ({ query }),
  });

  const events = await service.listAuditEventsForEntity({
    entityId: 'run-77',
    entityType: 'operation_run',
    limit: 4,
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['operation_run', 'run-77', 4]);
  assert.equal(events[0].eventType, 'library_scan_started');
});

test('audit read service redacts operator-visible sensitive detail fields', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      details: {
        accessToken: 'secret-token',
        libraryRoot: '/mnt/music/library',
        note: 'Email admin@example.com about /app/data/backups/backup-1.json',
      },
      entity_id: 'run-90',
      entity_type: 'operation_run',
      event_type: 'backup_restore_failed',
      id: 'audit-90',
      occurred_at: '2026-05-01T16:25:00.000Z',
      summary: 'Backup restore failed',
    }],
  }));
  const service = createAuditReadService({
    getPoolFn: () => ({ query }),
  });

  const events = await service.listRecentAuditEvents({ limit: 3 });

  assert.deepEqual(events[0].details, {
    accessToken: '[REDACTED]',
    libraryRoot: '[REDACTED_PATH]',
    note: 'Email [REDACTED_EMAIL] about [REDACTED_PATH]',
  });
});
