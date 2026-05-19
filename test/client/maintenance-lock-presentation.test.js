import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeLockImpact,
  formatDiagnosticTimestamp,
  formatLockExpiresAt,
  formatLockStatus,
  formatLockType,
  getLockStatusTone,
} from '../../src/client/lib/maintenance-lock-presentation.js';

test('formatLockType returns human-readable labels', () => {
  assert.equal(formatLockType('backup_restore'), 'Backup restore');
  assert.equal(formatLockType('maintenance'), 'Maintenance');
  assert.equal(formatLockType('upgrade'), 'Upgrade');
  assert.equal(formatLockType('admin_recovery'), 'Admin recovery');
  assert.equal(formatLockType('unknown_type'), 'unknown_type');
  assert.equal(formatLockType(null), 'Unknown');
});

test('formatLockStatus returns correct status', () => {
  const futureDate = new Date(Date.now() + 3600000).toISOString();
  const pastDate = new Date(Date.now() - 3600000).toISOString();

  assert.equal(formatLockStatus({ status: 'released' }), 'Released');
  assert.equal(formatLockStatus({ expiresAt: futureDate }), 'Active');
  assert.equal(formatLockStatus({ expiresAt: pastDate }), 'Expired');
  assert.equal(formatLockStatus(null), 'Unknown');
});

test('getLockStatusTone returns correct tone', () => {
  const futureDate = new Date(Date.now() + 3600000).toISOString();
  const pastDate = new Date(Date.now() - 3600000).toISOString();

  assert.equal(getLockStatusTone({ expiresAt: futureDate }), 'warning');
  assert.equal(getLockStatusTone({ status: 'released' }), null);
  assert.equal(getLockStatusTone({ expiresAt: pastDate }), null);
});

test('formatLockExpiresAt formats date or returns fallback', () => {
  assert.equal(formatLockExpiresAt(null), 'No expiry');
  assert.equal(formatLockExpiresAt({}), 'No expiry');
  const formatted = formatLockExpiresAt({ expiresAt: '2027-06-01T12:00:00Z' });
  assert.ok(formatted.length > 0, 'should return a non-empty formatted string');
  assert.notEqual(formatted, 'No expiry', 'should not return the fallback');
});

test('describeLockImpact returns per-type descriptions', () => {
  assert.ok(describeLockImpact('backup_restore').includes('backup restore'));
  assert.ok(describeLockImpact('maintenance').includes('maintenance'));
  assert.ok(describeLockImpact('upgrade').includes('upgrade'));
  assert.ok(describeLockImpact('unknown').includes('system'));
});

test('formatDiagnosticTimestamp returns formatted or fallback', () => {
  assert.equal(formatDiagnosticTimestamp(null), '\u2014');
  assert.equal(formatDiagnosticTimestamp(''), '\u2014');
  assert.ok(formatDiagnosticTimestamp('2026-05-20T00:00:00Z').length > 2);
});
