import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

async function waitFor(predicate, {
  intervalMs = 10,
  timeoutMs = 1_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the expected polling state');
    }

    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
  }
}

function makeOnboardingPayload(issueCount = 0, overrides = {}) {
  return {
    summary: {
      status: issueCount > 0 ? 'attention' : 'healthy',
      completeStepCount: 5 - issueCount,
      totalStepCount: 5,
      issueCount,
      message: issueCount > 0 ? `${issueCount} items need attention` : 'All ready.',
    },
    nextAction: issueCount > 0 ? { label: 'Open Settings', to: '/app/settings' } : null,
    steps: [],
    ...overrides,
  };
}

describe('useOnboardingSummary SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    const workflow = useOnboardingSummary({
      fetchOnboardingSummary: async () => makeOnboardingPayload(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadOnboardingSummary();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    const workflow = useOnboardingSummary({
      fetchOnboardingSummary: async () => makeOnboardingPayload(),
    });

    await workflow.loadOnboardingSummary();
    const secondLoad = workflow.loadOnboardingSummary();
    assert.equal(workflow.isRevalidating.value, true);
    await secondLoad;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('preserves stale data on revalidation error', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    let callCount = 0;
    const fetchOnboardingSummary = async () => {
      callCount += 1;
      if (callCount === 1) return makeOnboardingPayload(2);
      throw new Error('network fail');
    };

    const workflow = useOnboardingSummary({ fetchOnboardingSummary });

    await workflow.loadOnboardingSummary();
    assert.equal(workflow.summary.value.issueCount, 2);

    await workflow.loadOnboardingSummary();
    assert.equal(workflow.summary.value.issueCount, 2, 'stale summary preserved');
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('clears data on first-load error', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    const workflow = useOnboardingSummary({
      fetchOnboardingSummary: async () => { throw new Error('first fail'); },
    });

    await workflow.loadOnboardingSummary();
    assert.equal(workflow.summary.value, null);
    assert.ok(workflow.errorMessage.value);

    workflow.destroy();
  });

  test('pollIntervalMs schedules recurring loads while issues exist', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    let callCount = 0;
    const fetchOnboardingSummary = async () => {
      callCount += 1;
      return makeOnboardingPayload(2);
    };

    const workflow = useOnboardingSummary({ fetchOnboardingSummary, pollIntervalMs: 30 });

    await workflow.loadOnboardingSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    workflow.destroy();
  });

  test('polling stops when issues are resolved', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    let callCount = 0;
    const fetchOnboardingSummary = async () => {
      callCount += 1;
      if (callCount <= 2) return makeOnboardingPayload(1);
      return makeOnboardingPayload(0);
    };

    const workflow = useOnboardingSummary({ fetchOnboardingSummary, pollIntervalMs: 40 });

    await workflow.loadOnboardingSummary();

    await waitFor(() => callCount === 3 && workflow.summary.value?.issueCount === 0);
    const countAfterResolution = callCount;

    await new Promise((resolve) => { setTimeout(resolve, 120); });
    assert.equal(callCount, countAfterResolution, 'polling stopped after issues resolved');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    let callCount = 0;
    const fetchOnboardingSummary = async () => {
      callCount += 1;
      return makeOnboardingPayload(1);
    };

    const workflow = useOnboardingSummary({ fetchOnboardingSummary, pollIntervalMs: 30 });

    await workflow.loadOnboardingSummary();
    assert.equal(callCount, 1);

    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useOnboardingSummary } = await import('../../src/client/composables/useOnboardingSummary.js');

    let callCount = 0;
    const fetchOnboardingSummary = async () => {
      callCount += 1;
      return makeOnboardingPayload(1);
    };

    const workflow = useOnboardingSummary({ fetchOnboardingSummary, pollIntervalMs: 0 });

    await workflow.loadOnboardingSummary();
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    workflow.destroy();
  });
});
