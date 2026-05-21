import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserTrustExportService } from '../../src/server/activity/source-user-trust-export-service.js';

test('exportSourceUserTrustHistory returns JSON export with full history sorted oldest-first', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([{
      failureCount: 1,
      successCount: 2,
      trustHistory: [
        { id: 'evt-2', kind: 'manual_override', occurredAt: '2026-06-02T10:00:00.000Z', trustState: 'trusted' },
        { id: 'evt-1', kind: 'delivery_evidence', occurredAt: '2026-06-01T10:00:00.000Z', outcome: 'success' },
      ],
      trustState: 'trusted',
      updatedAt: '2026-06-02T10:00:00.000Z',
      username: 'peer-1',
    }]),
  });

  const result = await service.exportSourceUserTrustHistory({ username: 'peer-1' });

  assert.equal(result.mediaType, 'application/json');
  assert.equal(result.username, 'peer-1');
  assert.equal(result.totalEntries, 2);
  assert.equal(result.payload.totalEntries, 2);
  assert.equal(result.payload.sourceUser.trustHistory[0].id, 'evt-1');
  assert.equal(result.payload.sourceUser.trustHistory[1].id, 'evt-2');
  assert.ok(result.filename.endsWith('.json'));
  assert.ok(result.filename.includes('peer-1'));
});

test('exportSourceUserTrustHistory returns CSV export when format is csv', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([{
      failureCount: 0,
      successCount: 1,
      trustHistory: [
        { actorUserId: 'admin-1', eventType: 'source_user_trust_overridden', id: 'evt-1', kind: 'manual_override', occurredAt: '2026-06-01T12:00:00.000Z', reason: 'Verified', trustState: 'trusted' },
      ],
      trustState: 'trusted',
      updatedAt: '2026-06-01T12:00:00.000Z',
      username: 'peer-1',
    }]),
  });

  const result = await service.exportSourceUserTrustHistory({ format: 'csv', username: 'peer-1' });

  assert.equal(result.mediaType, 'text/csv');
  assert.ok(result.filename.endsWith('.csv'));
  assert.ok(result.payload.includes('occurredAt,kind,eventType,outcome,trustState,actorUserId,reason,operatorNotes'));
  assert.ok(result.payload.includes('2026-06-01T12:00:00.000Z'));
  assert.ok(result.payload.includes('manual_override'));
  assert.ok(result.payload.includes('Verified'));
});

test('exportSourceUserTrustHistory escapes CSV fields containing commas and quotes', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([{
      failureCount: 0,
      successCount: 0,
      trustHistory: [
        { id: 'evt-1', kind: 'delivery_evidence', occurredAt: '2026-06-01T10:00:00.000Z', reason: 'Has, comma and "quotes"' },
      ],
      trustState: 'neutral',
      updatedAt: '2026-06-01T10:00:00.000Z',
      username: 'peer-1',
    }]),
  });

  const result = await service.exportSourceUserTrustHistory({ format: 'csv', username: 'peer-1' });
  const lines = result.payload.split('\r\n');

  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('"Has, comma and ""quotes"""'));
});

test('exportSourceUserTrustHistory uses text/csv when Accept header includes text/csv', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([{
      trustHistory: [],
      trustState: 'neutral',
      username: 'peer-1',
    }]),
  });

  const result = await service.exportSourceUserTrustHistory({ accept: 'text/csv', username: 'peer-1' });

  assert.equal(result.mediaType, 'text/csv');
});

test('exportSourceUserTrustHistory defaults to JSON when no format or accept header', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([{
      trustHistory: [],
      trustState: 'neutral',
      username: 'peer-1',
    }]),
  });

  const result = await service.exportSourceUserTrustHistory({ username: 'peer-1' });

  assert.equal(result.mediaType, 'application/json');
});

test('exportSourceUserTrustHistory rejects unknown format values', async () => {
  const service = createSourceUserTrustExportService();

  await assert.rejects(
    () => service.exportSourceUserTrustHistory({ format: 'xml', username: 'peer-1' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('exportSourceUserTrustHistory rejects missing usernames', async () => {
  const service = createSourceUserTrustExportService();

  await assert.rejects(
    () => service.exportSourceUserTrustHistory({ username: '' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('exportSourceUserTrustHistory returns 404 for unknown users', async () => {
  const service = createSourceUserTrustExportService({
    listTrustSnapshot: async () => ([]),
  });

  await assert.rejects(
    () => service.exportSourceUserTrustHistory({ username: 'missing-peer' }),
    (error) => error?.status === 404 && error?.code === 'source_user_not_found',
  );
});
