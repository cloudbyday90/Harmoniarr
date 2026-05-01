import assert from 'node:assert/strict';
import test from 'node:test';
import { useOnboardingSummary } from '../../src/client/composables/useOnboardingSummary.js';

test('useOnboardingSummary loads the shared onboarding checklist payload', async (t) => {
  const fetchOnboardingSummary = t.mock.fn(async () => ({
    summary: {
      status: 'attention',
      completeStepCount: 3,
      totalStepCount: 5,
      issueCount: 2,
      message: '2 setup items need attention before scans or imports.',
    },
    nextAction: {
      label: 'Open Settings',
      to: '/app/settings',
    },
    steps: [{ id: 'paths', status: 'attention' }],
  }));
  const workflow = useOnboardingSummary({ fetchOnboardingSummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadOnboardingSummary();

  assert.equal(fetchOnboardingSummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.summary.value.issueCount, 2);
  assert.deepEqual(workflow.nextAction.value, {
    label: 'Open Settings',
    to: '/app/settings',
  });
  assert.deepEqual(workflow.steps.value, [{ id: 'paths', status: 'attention' }]);
});

test('useOnboardingSummary clears stale state when onboarding fetch fails', async () => {
  const workflow = useOnboardingSummary({
    fetchOnboardingSummary: async () => {
      throw new Error('onboarding summary unavailable');
    },
  });

  await workflow.loadOnboardingSummary();

  assert.equal(workflow.onboardingSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'onboarding summary unavailable');
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.nextAction.value, null);
});