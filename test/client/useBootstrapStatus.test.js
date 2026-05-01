import assert from 'node:assert/strict';
import test from 'node:test';
import { useBootstrapStatus } from '../../src/client/composables/useBootstrapStatus.js';

test('useBootstrapStatus loads bootstrap preflight summary from the injected shared route client', async (t) => {
  const fetchBootstrapStatus = t.mock.fn(async () => ({
    bootstrapRequired: true,
    pathValidation: {
      checkedAt: '2026-04-30T21:00:00.000Z',
      configuredDownloadMappings: 2,
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
    },
  }));
  const workflow = useBootstrapStatus({ fetchBootstrapStatus });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadStatus();

  assert.equal(fetchBootstrapStatus.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.deepEqual(workflow.pathValidationSummary.value, {
    checkedAt: '2026-04-30T21:00:00.000Z',
    configuredDownloadMappings: 2,
    message: 'Validation needs attention',
    status: 'degraded',
  });
  assert.equal(workflow.isLoading.value, false);
});

test('useBootstrapStatus clears stale state on bootstrap status failures', async () => {
  const workflow = useBootstrapStatus({
    fetchBootstrapStatus: async () => {
      throw new Error('bootstrap status unavailable');
    },
  });

  await workflow.loadStatus();

  assert.equal(workflow.bootstrapStatus.value, null);
  assert.equal(workflow.errorMessage.value, 'bootstrap status unavailable');
  assert.equal(workflow.pathValidationSummary.value, null);
  assert.equal(workflow.isLoading.value, false);
});