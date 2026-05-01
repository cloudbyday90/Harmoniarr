import assert from 'node:assert/strict';
import test from 'node:test';
import { useSystemOverview } from '../../src/client/composables/useSystemOverview.js';

test('useSystemOverview loads overview state and dependency statuses', async (t) => {
  const fetchOverview = t.mock.fn(async () => ({
    service: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
      startedAt: '2026-04-30T12:00:00.000Z',
    },
    discoveryHeartbeat: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    database: {
      name: 'postgresql',
      appliedMigrations: 4,
      pendingMigrations: 0,
    },
    dependencies: [{
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      details: {
        retryAfterMs: 2000,
        throttled: true,
      },
      observedAt: '2026-04-30T12:05:00.000Z',
    }],
    paths: [{
      label: 'Music library',
      value: '/data/music',
      description: 'Final managed library root.',
    }],
    pathValidation: {
      checkedAt: '2026-04-30T12:10:00.000Z',
      configuredDownloadMappings: 2,
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
    },
  }));

  const workflow = useSystemOverview({ fetchOverview });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadOverview();

  assert.equal(fetchOverview.mock.callCount(), 1);
  assert.equal(workflow.isLoading.value, false);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.statusPills.value, [
    { label: 'Service', value: 'harmoniarr' },
    { label: 'Version', value: '0.1.0-beta' },
    { label: 'Discovery cadence', value: '15 minutes' },
    { label: 'Pending migrations', value: '0' },
  ]);
  assert.deepEqual(workflow.dependencyStatuses.value, [{
    provider: 'musicbrainz',
    status: 'degraded',
    code: 'musicbrainz_unavailable',
    details: {
      retryAfterMs: 2000,
      throttled: true,
    },
    observedAt: '2026-04-30T12:05:00.000Z',
  }]);
  assert.deepEqual(workflow.pathCards.value, [{
    label: 'Music library',
    value: '/data/music',
    description: 'Final managed library root.',
  }]);
  assert.deepEqual(workflow.pathValidationSummary.value, {
    checkedAt: '2026-04-30T12:10:00.000Z',
    configuredDownloadMappings: 2,
    message: 'Validation needs attention',
    status: 'degraded',
  });
});

test('useSystemOverview surfaces overview load failures', async () => {
  const workflow = useSystemOverview({
    fetchOverview: async () => {
      throw new Error('overview unavailable');
    },
  });

  await workflow.loadOverview();

  assert.equal(workflow.isLoading.value, false);
  assert.equal(workflow.errorMessage.value, 'overview unavailable');
  assert.equal(workflow.overview.value, null);
  assert.deepEqual(workflow.statusPills.value, []);
  assert.deepEqual(workflow.dependencyStatuses.value, []);
  assert.equal(workflow.pathValidationSummary.value, null);
});
