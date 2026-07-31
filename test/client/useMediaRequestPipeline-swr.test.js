import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useMediaRequestPipeline } from '../../src/client/composables/useMediaRequestPipeline.js';

function makeCandidates(...statuses) {
  return statuses.map((status, i) => ({ id: `cand-${i}`, status, username: `user${i}` }));
}

async function waitFor(predicate, { timeoutMs = 250, intervalMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
  }

  assert.fail('Timed out waiting for the expected state');
}

describe('useMediaRequestPipeline SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const fetchPipelineFn = async () => ({ candidates: makeCandidates('pending') });
    const pipeline = useMediaRequestPipeline({ fetchPipelineFn });

    assert.equal(pipeline.isRevalidating.value, false);
    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(pipeline.isRevalidating.value, false);
  });

  test('isRevalidating is true during revalidation', async () => {
    const fetchPipelineFn = async () => ({ candidates: makeCandidates('downloading') });
    const pipeline = useMediaRequestPipeline({ fetchPipelineFn });

    await pipeline.load({ mediaRequestId: 'req-1' });

    const secondLoad = pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(pipeline.isRevalidating.value, true);
    await secondLoad;
    assert.equal(pipeline.isRevalidating.value, false);
  });

  test('preserves stale candidates on revalidation error', async () => {
    let callCount = 0;
    const fetchPipelineFn = async () => {
      callCount += 1;
      if (callCount === 1) return { candidates: makeCandidates('downloading') };
      throw new Error('reval fail');
    };

    const pipeline = useMediaRequestPipeline({ fetchPipelineFn });

    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(pipeline.candidates.value.length, 1);

    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(pipeline.candidates.value.length, 1, 'stale candidates preserved');
    assert.equal(pipeline.errorMessage.value, 'reval fail');
  });

  test('clears candidates on first-load error', async () => {
    const fetchPipelineFn = async () => { throw new Error('first fail'); };
    const pipeline = useMediaRequestPipeline({ fetchPipelineFn });

    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.deepEqual(pipeline.candidates.value, []);
    assert.equal(pipeline.errorMessage.value, 'first fail');
  });

  test('pollIntervalMs schedules recurring loads while candidates are active', async () => {
    let callCount = 0;
    const fetchPipelineFn = async () => {
      callCount += 1;
      return { candidates: makeCandidates('downloading') };
    };

    const pipeline = useMediaRequestPipeline({ fetchPipelineFn, pollIntervalMs: 30 });

    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    pipeline.destroy();
  });

  test('polling stops when all candidates reach terminal status', async () => {
    let callCount = 0;
    const fetchPipelineFn = async () => {
      callCount += 1;
      if (callCount <= 2) {
        return { candidates: makeCandidates('downloading') };
      }
      return { candidates: makeCandidates('applied') };
    };

    const pipeline = useMediaRequestPipeline({ fetchPipelineFn, pollIntervalMs: 30 });

    await pipeline.load({ mediaRequestId: 'req-1' });

    await waitFor(() => callCount >= 3);
    const countAfterTerminal = callCount;

    await new Promise((resolve) => { setTimeout(resolve, 100); });
    assert.equal(callCount, countAfterTerminal, 'polling stopped after candidates became terminal');

    pipeline.destroy();
  });

  test('destroy stops polling', async () => {
    let callCount = 0;
    const fetchPipelineFn = async () => {
      callCount += 1;
      return { candidates: makeCandidates('downloading') };
    };

    const pipeline = useMediaRequestPipeline({ fetchPipelineFn, pollIntervalMs: 30 });

    await pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    pipeline.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let callCount = 0;
    const fetchPipelineFn = async () => {
      callCount += 1;
      return { candidates: makeCandidates('downloading') };
    };

    const pipeline = useMediaRequestPipeline({ fetchPipelineFn, pollIntervalMs: 0 });

    await pipeline.load({ mediaRequestId: 'req-1' });

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    pipeline.destroy();
  });

  test('reset clears hasLoaded so next load is first load', async () => {
    const fetchPipelineFn = async () => ({ candidates: makeCandidates('pending') });
    const pipeline = useMediaRequestPipeline({ fetchPipelineFn });

    await pipeline.load({ mediaRequestId: 'req-1' });

    pipeline.reset();

    const loadPromise = pipeline.load({ mediaRequestId: 'req-1' });
    assert.equal(pipeline.isLoading.value, true);
    assert.equal(pipeline.isRevalidating.value, false);
    await loadPromise;
    assert.equal(pipeline.isLoading.value, false);

    pipeline.destroy();
  });
});
