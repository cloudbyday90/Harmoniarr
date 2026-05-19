import assert from 'node:assert/strict';
import test from 'node:test';
import { useMaintenanceLocks } from '../../src/client/composables/useMaintenanceLocks.js';

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

const FUTURE = new Date(Date.now() + 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

function setupDocument() {
  globalThis.document = { cookie: '' };
}

test('useMaintenanceLocks loadLocks populates locks from API', async (t) => {
  const locksPayload = {
    locks: [
      { id: 'l1', lockType: 'maintenance', expiresAt: FUTURE, reason: 'test', createdAt: PAST },
      { id: 'l2', lockType: 'backup_restore', expiresAt: PAST, reason: 'old', status: 'released' },
    ],
  };

  globalThis.fetch = t.mock.fn(async () => jsonResponse(locksPayload));

  const { locks, isLoading, hasActiveLocks, loadLocks } = useMaintenanceLocks();

  assert.equal(isLoading.value, true);
  await loadLocks();
  assert.equal(isLoading.value, false);
  assert.equal(locks.value.length, 2);
  assert.equal(hasActiveLocks.value, true);
});

test('useMaintenanceLocks hasActiveLocks false when all locks are expired', async (t) => {
  const locksPayload = {
    locks: [
      { id: 'l1', lockType: 'maintenance', expiresAt: PAST, reason: 'old' },
    ],
  };

  globalThis.fetch = t.mock.fn(async () => jsonResponse(locksPayload));

  const { locks, hasActiveLocks, loadLocks } = useMaintenanceLocks();

  await loadLocks();
  assert.equal(locks.value.length, 1);
  assert.equal(hasActiveLocks.value, false);
});

test('useMaintenanceLocks handles API errors', async (t) => {
  globalThis.fetch = t.mock.fn(async () => {
    throw new Error('Network error');
  });

  const { errorMessage, isLoading, loadLocks } = useMaintenanceLocks();

  await loadLocks();
  assert.equal(isLoading.value, false);
  assert.ok(errorMessage.value, 'should set error message on failure');
});

test('useMaintenanceLocks releaseLock calls API and reloads', async (t) => {
  setupDocument();
  globalThis.fetch = t.mock.fn(async () => jsonResponse({ ok: true }));

  const { releaseLock } = useMaintenanceLocks();

  const result = await releaseLock('lock-1');
  assert.equal(result, true);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});

test('useMaintenanceLocks releaseLock handles API errors', async (t) => {
  setupDocument();
  globalThis.fetch = t.mock.fn(async () => {
    throw new Error('Forbidden');
  });

  const { actionError, releaseLock } = useMaintenanceLocks();

  const result = await releaseLock('lock-1');
  assert.equal(result, false);
  assert.ok(actionError.value, 'should set action error on failure');
});

test('useMaintenanceLocks enterLock calls API and reloads', async (t) => {
  setupDocument();
  globalThis.fetch = t.mock.fn(async () => jsonResponse({ ok: true }));

  const { enterLock } = useMaintenanceLocks();

  const result = await enterLock({
    lockType: 'maintenance',
    expiresAt: FUTURE,
    reason: 'Testing',
  });
  assert.equal(result, true);
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});

test('useMaintenanceLocks enterLock handles API errors', async (t) => {
  setupDocument();
  globalThis.fetch = t.mock.fn(async () => {
    throw new Error('Conflict');
  });

  const { actionError, enterLock } = useMaintenanceLocks();

  const result = await enterLock({ lockType: 'maintenance' });
  assert.equal(result, false);
  assert.ok(actionError.value, 'should set action error on failure');
});

test('useMaintenanceLocks activeLocks filters out released and expired', async (t) => {
  globalThis.fetch = t.mock.fn(async () => jsonResponse({
    locks: [
      { id: 'l1', lockType: 'maintenance', expiresAt: FUTURE },
      { id: 'l2', lockType: 'upgrade', expiresAt: PAST },
      { id: 'l3', lockType: 'backup_restore', status: 'released' },
    ],
  }));

  const { activeLocks, loadLocks } = useMaintenanceLocks();

  await loadLocks();
  assert.equal(activeLocks.value.length, 1);
  assert.equal(activeLocks.value[0].lockType, 'maintenance');
});
