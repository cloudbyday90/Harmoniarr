import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

function makeOverviewPayload(overrides = {}) {
  return {
    service: { name: 'harmoniarr', version: '0.1.0' },
    dependencies: [],
    heartbeats: [],
    paths: [],
    database: { pendingMigrations: 0 },
    discoveryHeartbeat: { intervalLabel: '15 minutes' },
    importExecutionHeartbeat: { intervalLabel: '10 minutes' },
    metadataRefreshHeartbeat: { intervalLabel: '24 hours' },
    ...overrides,
  };
}

function makeNotificationsPayload(overrides = {}) {
  return {
    checkedAt: '2026-05-01T12:00:00.000Z',
    counts: { actionable: 0, byCategory: { failure: 0, manual_intervention: 0, queued_work: 0, recovery: 0 }, total: 0 },
    notifications: [],
    ...overrides,
  };
}

describe('useSystemOverview SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    const workflow = useSystemOverview({
      fetchOverview: async () => makeOverviewPayload(),
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadOverview();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    const workflow = useSystemOverview({
      fetchOverview: async () => makeOverviewPayload(),
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
    });

    await workflow.loadOverview();
    assert.equal(workflow.isRevalidating.value, false);

    const secondLoad = workflow.loadOverview();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    let callCount = 0;
    const fetchOverview = async () => {
      callCount += 1;
      if (callCount === 1) {
        return makeOverviewPayload({ service: { name: 'harmoniarr', version: '1.0.0' } });
      }
      throw new Error('network fail');
    };

    const workflow = useSystemOverview({
      fetchOverview,
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
    });

    await workflow.loadOverview();
    assert.equal(workflow.statusPills.value[0].value, 'harmoniarr');
    assert.equal(workflow.operatorNotifications.value.length, 0);

    await workflow.loadOverview();
    assert.equal(workflow.statusPills.value[0].value, 'harmoniarr', 'stale overview preserved');
    assert.equal(workflow.operatorNotifications.value.length, 0, 'stale notifications preserved');
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    const fetchOverview = async () => { throw new Error('first fail'); };
    const workflow = useSystemOverview({
      fetchOverview,
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
    });

    await workflow.loadOverview();
    assert.equal(workflow.overview.value, null);
    assert.equal(workflow.statusPills.value.length, 0);
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    let callCount = 0;
    const fetchOverview = async () => {
      callCount += 1;
      return makeOverviewPayload();
    };

    const workflow = useSystemOverview({
      fetchOverview,
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
      pollIntervalMs: 30,
    });

    await workflow.loadOverview();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    let callCount = 0;
    const fetchOverview = async () => {
      callCount += 1;
      return makeOverviewPayload();
    };

    const workflow = useSystemOverview({
      fetchOverview,
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
      pollIntervalMs: 30,
    });

    await workflow.loadOverview();
    assert.equal(callCount, 1);

    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useSystemOverview } = await import('../../src/client/composables/useSystemOverview.js');

    let callCount = 0;
    const fetchOverview = async () => {
      callCount += 1;
      return makeOverviewPayload();
    };

    const workflow = useSystemOverview({
      fetchOverview,
      fetchOperatorNotifications: async () => makeNotificationsPayload(),
      pollIntervalMs: 0,
    });

    await workflow.loadOverview();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});
