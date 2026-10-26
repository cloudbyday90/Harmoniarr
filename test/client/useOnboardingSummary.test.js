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

test('useOnboardingSummary keeps initial state empty and returns fixed feedback when onboarding fetch fails', async () => {
  const workflow = useOnboardingSummary({
    fetchOnboardingSummary: async () => {
      throw new Error('onboarding summary unavailable');
    },
  });

  await workflow.loadOnboardingSummary();

  assert.equal(workflow.onboardingSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'Setup status could not be loaded. Refresh to try again.');
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
  assert.equal(workflow.errorMessage.value, 'Setup status could not be loaded. Refresh to try again.');

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

test('overlapping initial and refresh reads coalesce while retaining the last successful checklist', async () => {
  const gates = [Promise.withResolvers(), Promise.withResolvers()]; let calls = 0;
  const workflow = useOnboardingSummary({ fetchOnboardingSummary: () => gates[calls++].promise });
  const first = workflow.loadOnboardingSummary(); assert.equal(workflow.loadOnboardingSummary(), first);
  await Promise.resolve(); assert.equal(calls, 1);
  gates[0].resolve({ summary: { issueCount: 1 }, steps: [{ id: 'database', status: 'unavailable' }] }); await first;
  const second = workflow.loadOnboardingSummary(); assert.equal(workflow.loadOnboardingSummary(), second);
  assert.equal(workflow.isRevalidating.value, true); assert.equal(workflow.steps.value[0].status, 'unavailable');
  await Promise.resolve(); assert.equal(calls, 2); gates[1].reject(new Error('private /secret SELECT')); await second;
  assert.equal(workflow.isRevalidating.value, false); assert.equal(workflow.steps.value[0].status, 'unavailable');
  assert.doesNotMatch(workflow.errorMessage.value, /private|secret|SELECT/u); workflow.destroy();
});

test('destroy suppresses late success or failure updates and closes new read admission', async () => {
  for (const succeeds of [true, false]) {
    const gate = Promise.withResolvers(); let calls = 0;
    const workflow = useOnboardingSummary({ fetchOnboardingSummary: () => { calls++; return gate.promise; } });
    const load = workflow.loadOnboardingSummary(); await Promise.resolve(); workflow.destroy();
    if (succeeds) gate.resolve({ summary: { issueCount: 0 } }); else gate.reject(new Error('private'));
    await load; await workflow.loadOnboardingSummary();
    assert.equal(calls, 1); assert.equal(workflow.onboardingSummary.value, null); assert.equal(workflow.errorMessage.value, '');
  }
  let calls = 0; const workflow = useOnboardingSummary({ fetchOnboardingSummary: () => { calls++; } });
  const load = workflow.loadOnboardingSummary(); workflow.destroy(); await load; assert.equal(calls, 0);
});
