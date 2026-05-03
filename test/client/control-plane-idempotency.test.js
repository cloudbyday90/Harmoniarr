import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createControlPlaneIdempotencyHeaders,
  createControlPlaneIdempotencyKey,
} from '../../src/client/lib/control-plane-idempotency.js';

test('createControlPlaneIdempotencyKey normalizes the scope prefix', () => {
  const key = createControlPlaneIdempotencyKey(' recovery.backups.restore-apply ');

  assert.match(key, /^recovery-backups-restore-apply-/);
});

test('createControlPlaneIdempotencyHeaders returns a request-ready header object', () => {
  const headers = createControlPlaneIdempotencyHeaders('recovery.maintenance-locks.enter');

  assert.equal(typeof headers['Idempotency-Key'], 'string');
  assert.match(headers['Idempotency-Key'], /^recovery-maintenance-locks-enter-/);
});
