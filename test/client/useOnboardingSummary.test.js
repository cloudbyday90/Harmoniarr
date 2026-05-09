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

test('useOnboardingSummary isLoading is false after a successful load', async (t) => {
  const fetchOnboardingSummary = t.mock.fn(async () => ({
    summary: { status: 'healthy', completeStepCount: 4, totalStepCount: 4, issueCount: 0, message: 'All ready.' },
    nextAction: null,
    steps: [],
  }));
  const workflow = useOnboardingSummary({ fetchOnboardingSummary });

  await workflow.loadOnboardingSummary();

  assert.equal(workflow.isLoading.value, false);
});

test('useOnboardingSummary isLoading is false after a failed load', async () => {
  const workflow = useOnboardingSummary({
    fetchOnboardingSummary: async () => { throw new Error('network error'); },
  });

  await workflow.loadOnboardingSummary();

  assert.equal(workflow.isLoading.value, false);
});

test('useOnboardingSummary refresh clears prior error and loads new data', async () => {
  let callCount = 0;
  const workflow = useOnboardingSummary({
    fetchOnboardingSummary: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('first call failed');
      return {
        summary: { status: 'healthy', completeStepCount: 4, totalStepCount: 4, issueCount: 0, message: 'All ready.' },
        nextAction: null,
        steps: [],
      };
    },
  });

  await workflow.loadOnboardingSummary();
  assert.equal(workflow.errorMessage.value, 'first call failed');

  await workflow.loadOnboardingSummary();
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.summary.value.issueCount, 0);
});

test('useOnboardingSummary steps defaults to empty array when payload omits steps', async () => {
  const workflow = useOnboardingSummary({
    fetchOnboardingSummary: async () => ({
      summary: { status: 'healthy', completeStepCount: 0, totalStepCount: 0, issueCount: 0, message: '' },
      nextAction: null,
    }),
  });

  await workflow.loadOnboardingSummary();

  assert.deepEqual(workflow.steps.value, []);
});