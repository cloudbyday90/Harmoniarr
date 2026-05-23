import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useMediaRequestPipeline } from '../../src/client/composables/useMediaRequestPipeline.js';

describe('useMediaRequestPipeline', () => {
  test('initial state has empty candidates and no error', () => {
    const { candidates, isLoading, errorMessage } = useMediaRequestPipeline();
    assert.deepEqual(candidates.value, []);
    assert.equal(isLoading.value, false);
    assert.equal(errorMessage.value, '');
  });

  test('load does nothing when mediaRequestId is falsy', async () => {
    const fetchPipelineFn = async () => ({ candidates: [{ id: 'x' }] });
    const { candidates, load } = useMediaRequestPipeline({ fetchPipelineFn });
    await load({ mediaRequestId: '' });
    assert.deepEqual(candidates.value, []);
  });

  test('load fetches and stores candidates', async () => {
    const mockCandidates = [
      { id: 'cand-1', status: 'pending', username: 'user1' },
      { id: 'cand-2', status: 'applied', username: 'user2' },
    ];
    const fetchPipelineFn = async () => ({ candidates: mockCandidates });
    const { candidates, isLoading, errorMessage, load } = useMediaRequestPipeline({ fetchPipelineFn });

    await load({ mediaRequestId: 'req-1' });

    assert.equal(isLoading.value, false);
    assert.equal(errorMessage.value, '');
    assert.equal(candidates.value.length, 2);
    assert.equal(candidates.value[0].id, 'cand-1');
    assert.equal(candidates.value[1].status, 'applied');
  });

  test('load handles fetch error', async () => {
    const fetchPipelineFn = async () => { throw new Error('Network error'); };
    const { candidates, isLoading, errorMessage, load } = useMediaRequestPipeline({ fetchPipelineFn });

    await load({ mediaRequestId: 'req-1' });

    assert.equal(isLoading.value, false);
    assert.equal(errorMessage.value, 'Network error');
    assert.deepEqual(candidates.value, []);
  });

  test('load handles non-Error thrown value', async () => {
    const fetchPipelineFn = async () => { throw 'unexpected'; };
    const { errorMessage, load } = useMediaRequestPipeline({ fetchPipelineFn });

    await load({ mediaRequestId: 'req-1' });

    assert.equal(errorMessage.value, 'Failed to load pipeline data');
  });

  test('load handles missing candidates in response', async () => {
    const fetchPipelineFn = async () => ({});
    const { candidates, load } = useMediaRequestPipeline({ fetchPipelineFn });

    await load({ mediaRequestId: 'req-1' });
    assert.deepEqual(candidates.value, []);
  });

  test('reset clears state', async () => {
    const fetchPipelineFn = async () => ({ candidates: [{ id: 'cand-1' }] });
    const { candidates, errorMessage, load, reset } = useMediaRequestPipeline({ fetchPipelineFn });

    await load({ mediaRequestId: 'req-1' });
    assert.equal(candidates.value.length, 1);

    reset();
    assert.deepEqual(candidates.value, []);
    assert.equal(errorMessage.value, '');
  });
});
