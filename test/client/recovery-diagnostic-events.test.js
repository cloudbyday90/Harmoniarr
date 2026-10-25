/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecoveryDiagnosticEvents } from '../../src/client/lib/recovery-diagnostic-events.js';
import { createRecoveryDiagnosticsService } from '../../src/server/recovery/recovery-diagnostics-service.js';
const time = '2026-10-25T16:00:00.000Z';

test('real recovery service fields retain redacted failures, event times and distinct IDs despite identical type/time values', async () => {
  const service = createRecoveryDiagnosticsService({ listRecentOperationRuns: async () => [1, 2].map(id => ({ id: `run-${id}`, operationType: 'backup_restore_apply', status: 'failed', finishedAt: time, errorMessage: `Failure ${id} at /app/data/restore.json for ops@example.invalid` })),
    listRecentAuditEvents: async () => [{ id: 'audit-1', eventType: 'maintenance_lock_entered', occurredAt: time, summary: 'private-summary' }],
  });
  const result = buildRecoveryDiagnosticEvents(await service.getRecoveryDiagnostics());
  assert.deepEqual(result.failures.rows.map(row => [row.id, row.title, row.finishedAt, row.message]), [
    ['run-1', 'Backup restore apply', time, 'Failure 1 at [REDACTED_PATH] for [REDACTED_EMAIL]'],
    ['run-2', 'Backup restore apply', time, 'Failure 2 at [REDACTED_PATH] for [REDACTED_EMAIL]'],
  ]);
  assert.deepEqual(result.actions, { available: true, rows: [{ id: 'audit-1', title: 'Maintenance lock entered', occurredAt: time }] });
});

test('presentation bounds examined records and message size while refusing obsolete aliases and invalid dates', () => {
  const runs = Array.from({ length: 5 }, (_, i) => ({ id: `run-${i}`, operationType: 'unknown_private_type', finishedAt: i === 0 ? time : 'bad-date', errorMessage: 'x'.repeat(1001), recentFailureCount: 17 }));
  Object.defineProperty(runs, 5, { get: () => assert.fail('Do not inspect records outside the five-row window') });
  const projected = buildRecoveryDiagnosticEvents({ recentFailedRuns: runs, recentPrivilegedActions: [] });
  assert.equal(projected.failures.rows.length, 5); assert.equal(projected.failures.rows[0].message.length, 1001);
  assert.equal(projected.failures.rows[0].message.at(-1), '…'); assert.equal(projected.failures.rows[0].title, 'Background job');
  assert.equal(projected.failures.rows[1].finishedAt, null); assert.equal(projected.failures.rows[0].recentFailureCount, undefined);
  const legacy = buildRecoveryDiagnosticEvents({ recentFailedRuns: [{ id: 'legacy', recentFailureMessage: 'unsupported', recentFailureAt: time }], recentPrivilegedActions: [{ id: 'old-action', eventName: 'private-name', actorUserId: 'private-actor' }] });
  assert.equal(legacy.failures.rows[0].finishedAt, null); assert.equal(legacy.failures.rows[0].message, 'No failure message is available.');
  assert.deepEqual(legacy.actions.rows[0], { id: 'old-action', title: 'Privileged recovery action', occurredAt: null });
});

test('all five current privileged action types have fixed labels without projecting private summaries, details or actors', () => {
  const types = ['backup_restore_started', 'backup_restore_completed', 'backup_restore_failed', 'maintenance_lock_entered', 'maintenance_lock_released'];
  const data = types.map((eventType, i) => ({ id: `event-${i}`, eventType, occurredAt: time, summary: 'private', details: { token: 'private' }, actorUserId: 'private' }));
  const result = buildRecoveryDiagnosticEvents({ recentFailedRuns: [], recentPrivilegedActions: data });
  assert.deepEqual(result.actions.rows.map(row => row.title), ['Backup restore started', 'Backup restore completed', 'Backup restore failed', 'Maintenance lock entered', 'Maintenance lock released']);
  assert.ok(result.actions.rows.every(row => Object.keys(row).length === 3));
});

test('empty history differs from malformed or duplicate records and projections remain detached', () => {
  assert.deepEqual(buildRecoveryDiagnosticEvents({ recentFailedRuns: [], recentPrivilegedActions: [] }), { failures: { available: true, rows: [] }, actions: { available: true, rows: [] } });
  assert.equal(buildRecoveryDiagnosticEvents(null).failures.available, false);
  const input = { recentFailedRuns: [{ id: 'one', errorMessage: 'safe' }, { id: 'one', errorMessage: 'duplicate' }, null], recentPrivilegedActions: 'invalid' };
  const result = buildRecoveryDiagnosticEvents(input); assert.equal(result.failures.rows.length, 1); assert.equal(result.failures.available, false); assert.equal(result.actions.available, false);
  result.failures.rows[0].message = 'changed'; assert.equal(input.recentFailedRuns[0].errorMessage, 'safe');
});
