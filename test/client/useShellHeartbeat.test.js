import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useShellHeartbeat } from '../../src/client/composables/useShellHeartbeat.js';

function makePayload({ status = 'healthy', activeJobCount = 0 } = {}) {
  return {
    dependencies: [{ name: 'db', status }],
    heartbeats: [{ name: 'scheduler', status }],
    activeJobCount,
  };
}

describe('useShellHeartbeat SWR', () => {
  test('refresh populates status, detail, and activeJobs', async () => {
    const { status, detail, activeJobs, refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => makePayload({ status: 'healthy', activeJobCount: 3 }),
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(status.value, 'healthy');
    assert.equal(activeJobs.value, 3);
    assert.ok(detail.value.length > 0);
    destroy();
  });

  test('refresh handles 401 errors', async () => {
    const { status, detail, refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      },
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(status.value, 'unknown');
    assert.equal(detail.value, 'Sign in required');
    destroy();
  });

  test('refresh handles network errors', async () => {
    const { status, detail, refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => { throw new Error('Network error'); },
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(status.value, 'unavailable');
    assert.equal(detail.value, 'Unable to reach overview API');
    destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const { status, revalidate, refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => {
        callCount += 1;
        if (callCount === 1) return makePayload({ status: 'healthy' });
        throw new Error('Network error');
      },
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(status.value, 'healthy');

    await revalidate();
    assert.equal(status.value, 'healthy', 'stale data preserved on revalidation error');
    destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { isRevalidating, refresh, revalidate, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => makePayload(),
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(isRevalidating.value, false);

    const p = revalidate();
    assert.equal(isRevalidating.value, true);
    await p;
    assert.equal(isRevalidating.value, false);
    destroy();
  });

  test('destroy stops polling', async () => {
    let callCount = 0;
    const { refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => {
        callCount += 1;
        return makePayload();
      },
      pollIntervalMs: 50,
    });

    await refresh();
    assert.equal(callCount, 1);
    destroy();

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const { refresh, revalidate, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => {
        callCount += 1;
        return makePayload();
      },
      pollIntervalMs: 0,
    });

    await refresh();
    assert.equal(callCount, 1);
    destroy();

    await revalidate();
    assert.equal(callCount, 1, 'no fetch after destroy');
  });

  test('label computed returns human-readable status', async () => {
    const { label, refresh, destroy } = useShellHeartbeat({
      fetchSystemOverview: async () => makePayload({ status: 'degraded' }),
      pollIntervalMs: 0,
    });

    await refresh();
    assert.ok(label.value.length > 0);
    destroy();
  });
});
