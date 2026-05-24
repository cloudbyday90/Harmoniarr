import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick } from 'vue';
import { useImportCandidateBulkReview } from '../../src/client/composables/useImportCandidateBulkReview.js';

test('execute returns null when importCandidateIds is empty array', async () => {
  const bulkReviewImportCandidates = async () => ({ ok: true });
  const { execute } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  const result = await execute({ action: 'select', importCandidateIds: [] });

  assert.equal(result, null);
});

test('execute returns null when importCandidateIds is not an array', async () => {
  const bulkReviewImportCandidates = async () => ({ ok: true });
  const { execute } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  const result = await execute({ action: 'select', importCandidateIds: null });

  assert.equal(result, null);
});

test('execute calls bulkReviewImportCandidates and returns payload', async () => {
  const calls = [];
  const bulkReviewImportCandidates = async (params) => {
    calls.push(params);
    return { ok: true, total: 2, succeeded: 2, failed: 0 };
  };
  const { execute, isExecuting, lastResult } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  const result = await execute({ action: 'select', importCandidateIds: ['c1', 'c2'], reason: 'good' });

  assert.equal(result.ok, true);
  assert.equal(result.total, 2);
  assert.deepEqual(calls[0], { action: 'select', importCandidateIds: ['c1', 'c2'], reason: 'good' });
  assert.equal(lastResult.value.total, 2);
  assert.equal(isExecuting.value, false);
});

test('execute sets errorMessage on failure and returns null', async () => {
  const bulkReviewImportCandidates = async () => {
    throw new Error('Network error');
  };
  const { execute, errorMessage, isExecuting } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  const result = await execute({ action: 'reject', importCandidateIds: ['c1'] });

  assert.equal(result, null);
  assert.ok(errorMessage.value.length > 0);
  assert.equal(isExecuting.value, false);
});

test('reset clears all reactive state', async () => {
  const bulkReviewImportCandidates = async () => ({ ok: true, total: 1 });
  const { execute, errorMessage, isExecuting, lastResult, reset } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  await execute({ action: 'select', importCandidateIds: ['c1'] });
  assert.ok(lastResult.value);

  reset();

  assert.equal(errorMessage.value, '');
  assert.equal(isExecuting.value, false);
  assert.equal(lastResult.value, null);
});

test('execute sets isExecuting during operation', async () => {
  let resolveOperation;
  const bulkReviewImportCandidates = () => new Promise((resolve) => {
    resolveOperation = resolve;
  });
  const { execute, isExecuting } = useImportCandidateBulkReview({ bulkReviewImportCandidates });

  const promise = execute({ action: 'hold', importCandidateIds: ['c1'] });
  await nextTick();

  assert.equal(isExecuting.value, true);

  resolveOperation({ ok: true, total: 1 });
  await promise;

  assert.equal(isExecuting.value, false);
});
