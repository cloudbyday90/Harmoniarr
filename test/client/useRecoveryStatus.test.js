import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useRecoveryStatus } from '../../src/client/composables/useRecoveryStatus.js';

function makeStatus({ recoveryAvailable = true, remainingAttempts = 3, expiresAt = null, blockedByLock = false } = {}) {
  return { recoveryAvailable, remainingAttempts, expiresAt, blockedByLock };
}

describe('useRecoveryStatus SWR', () => {
  test('loadStatus populates status ref', async () => {
    const { status, loadStatus, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => makeStatus(),
      pollIntervalMs: 0,
    });

    assert.equal(status.value, null);
    await loadStatus();
    assert.equal(status.value.recoveryAvailable, true);
    assert.equal(status.value.remainingAttempts, 3);
    destroy();
  });

  test('loadStatus sets errorMessage on failure', async () => {
    const { errorMessage, loadStatus, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => { throw new Error('Network error'); },
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.equal(errorMessage.value, 'Network error');
    destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const { status, loadStatus, revalidate, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => {
        callCount += 1;
        if (callCount === 1) return makeStatus();
        throw new Error('refresh failed');
      },
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.equal(status.value.recoveryAvailable, true);

    await revalidate();
    assert.equal(status.value.recoveryAvailable, true, 'stale data preserved on revalidation error');
    destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { isRevalidating, loadStatus, revalidate, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => makeStatus(),
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.equal(isRevalidating.value, false);

    const p = revalidate();
    assert.equal(isRevalidating.value, true);
    await p;
    assert.equal(isRevalidating.value, false);
    destroy();
  });

  test('destroy stops polling', async () => {
    let callCount = 0;
    const { loadStatus, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => {
        callCount += 1;
        return makeStatus();
      },
      pollIntervalMs: 50,
    });

    await loadStatus();
    assert.equal(callCount, 1);
    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const { loadStatus, revalidate, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => {
        callCount += 1;
        return makeStatus();
      },
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.equal(callCount, 1);
    destroy();

    await revalidate();
    assert.equal(callCount, 1, 'no fetch after destroy');
  });

  test('secondsRemaining computed returns seconds until expiry', async () => {
    const futureDate = new Date(Date.now() + 90_000).toISOString();
    const { secondsRemaining, loadStatus, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => makeStatus({ expiresAt: futureDate }),
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.ok(secondsRemaining.value > 0);
    assert.ok(secondsRemaining.value <= 90);
    destroy();
  });

  test('submitRecovery stops polling and sets isCompleted', async () => {
    const { isCompleted, loadStatus, submitRecovery, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => makeStatus(),
      completeRecovery: async () => ({ success: true }),
      pollIntervalMs: 50,
    });

    await loadStatus();
    assert.equal(isCompleted.value, false);

    await submitRecovery({ username: 'test', password: 'newpass' });
    assert.equal(isCompleted.value, true);
    destroy();
  });

  test('computed properties reflect status state', async () => {
    const { recoveryAvailable, blockedByLock, remainingAttempts, loadStatus, destroy } = useRecoveryStatus({
      fetchRecoveryStatus: async () => makeStatus({
        recoveryAvailable: true,
        blockedByLock: true,
        remainingAttempts: 1,
      }),
      pollIntervalMs: 0,
    });

    await loadStatus();
    assert.equal(recoveryAvailable.value, true);
    assert.equal(blockedByLock.value, true);
    assert.equal(remainingAttempts.value, 1);
    destroy();
  });
});
