import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick } from 'vue';
import { useMediaRequestBulkCancel } from '../../src/client/composables/useMediaRequestBulkCancel.js';

test('useMediaRequestBulkCancel returns null for empty array', async () => {
  const bulkCancelMediaRequests = async () => ({ ok: true, total: 0 });
  const { execute } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  const result = await execute({ mediaRequestIds: [] });
  assert.equal(result, null);
});

test('useMediaRequestBulkCancel returns null for non-array', async () => {
  const bulkCancelMediaRequests = async () => ({ ok: true, total: 0 });
  const { execute } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  const result = await execute({ mediaRequestIds: null });
  assert.equal(result, null);
});

test('useMediaRequestBulkCancel executes bulk cancel', async () => {
  const bulkCancelMediaRequests = async () => ({
    ok: true,
    total: 2,
    succeeded: 2,
    failed: 0,
    results: [],
  });
  const { execute, isExecuting, lastResult } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  const result = await execute({ mediaRequestIds: ['req-1', 'req-2'], reason: 'done' });
  await nextTick();

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(lastResult.value.total, 2);
  assert.equal(isExecuting.value, false);
});

test('useMediaRequestBulkCancel sets errorMessage on failure', async () => {
  const bulkCancelMediaRequests = async () => {
    throw new Error('Server error');
  };
  const { execute, errorMessage, isExecuting } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  const result = await execute({ mediaRequestIds: ['req-1'] });
  await nextTick();

  assert.equal(result, null);
  assert.ok(errorMessage.value.length > 0);
  assert.equal(isExecuting.value, false);
});

test('useMediaRequestBulkCancel reset clears state', async () => {
  const bulkCancelMediaRequests = async () => ({
    ok: true, total: 1, succeeded: 1, failed: 0, results: [],
  });
  const { execute, errorMessage, isExecuting, lastResult, reset } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  await execute({ mediaRequestIds: ['req-1'] });
  await nextTick();
  reset();

  assert.equal(errorMessage.value, '');
  assert.equal(isExecuting.value, false);
  assert.equal(lastResult.value, null);
});

test('useMediaRequestBulkCancel sets isExecuting during operation', async () => {
  let resolveOperation;
  const bulkCancelMediaRequests = async () => {
    return new Promise((resolve) => { resolveOperation = resolve; });
  };
  const { execute, isExecuting } = useMediaRequestBulkCancel({ bulkCancelMediaRequests });

  const promise = execute({ mediaRequestIds: ['req-1'] });
  assert.equal(isExecuting.value, true);

  resolveOperation({ ok: true, total: 1, succeeded: 1, failed: 0, results: [] });
  await promise;
  await nextTick();

  assert.equal(isExecuting.value, false);
});
