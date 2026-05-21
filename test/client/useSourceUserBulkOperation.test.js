import assert from 'node:assert/strict';
import test from 'node:test';
import { useSourceUserBulkOperation } from '../../src/client/composables/useSourceUserBulkOperation.js';

function createMockFn(impl) {
  let callCount = 0;
  const fn = async (...args) => {
    callCount++;
    return impl(...args);
  };
  fn.callCount = () => callCount;
  return fn;
}

test('useSourceUserBulkOperation executeBulkTrust returns result on success', async () => {
  const bulkUpdate = createMockFn(async () => ({
    failed: 0,
    results: [{ ok: true, username: 'peer-1' }, { ok: true, username: 'peer-2' }],
    succeeded: 2,
    total: 2,
  }));
  const { executeBulkTrust, isExecuting, lastResult } = useSourceUserBulkOperation({
    bulkUpdateActivitySourceUserTrust: bulkUpdate,
  });

  const result = await executeBulkTrust({
    reason: 'Batch trust',
    trustState: 'trusted',
    usernames: ['peer-1', 'peer-2'],
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(lastResult.value.total, 2);
  assert.equal(isExecuting.value, false);
});

test('useSourceUserBulkOperation executeBulkBlock returns result on success', async () => {
  const bulkBlock = createMockFn(async () => ({
    failed: 0,
    results: [{ ok: true, username: 'spammer-1' }],
    succeeded: 1,
    total: 1,
  }));
  const { executeBulkBlock, lastResult } = useSourceUserBulkOperation({
    bulkBlockActivitySourceUsers: bulkBlock,
  });

  const result = await executeBulkBlock({
    reason: 'Spam',
    usernames: ['spammer-1'],
  });

  assert.equal(result.total, 1);
  assert.equal(lastResult.value.total, 1);
});

test('useSourceUserBulkOperation sets errorMessage on failure', async () => {
  const bulkUpdate = createMockFn(async () => {
    throw new Error('Server error');
  });
  const { errorMessage, executeBulkTrust } = useSourceUserBulkOperation({
    bulkUpdateActivitySourceUserTrust: bulkUpdate,
  });

  const result = await executeBulkTrust({
    reason: 'test',
    trustState: 'trusted',
    usernames: ['peer-1'],
  });

  assert.equal(result, null);
  assert.ok(errorMessage.value.length > 0);
});

test('useSourceUserBulkOperation no-ops for empty usernames', async () => {
  const { executeBulkTrust, executeBulkBlock } = useSourceUserBulkOperation({
    bulkUpdateActivitySourceUserTrust: async () => ({ total: 0, succeeded: 0, failed: 0, results: [] }),
    bulkBlockActivitySourceUsers: async () => ({ total: 0, succeeded: 0, failed: 0, results: [] }),
  });

  assert.equal(await executeBulkTrust({ reason: 'test', trustState: 'trusted', usernames: [] }), null);
  assert.equal(await executeBulkBlock({ reason: 'test', usernames: [] }), null);
});

test('useSourceUserBulkOperation reset clears state', async () => {
  const bulkUpdate = createMockFn(async () => ({
    failed: 0, results: [], succeeded: 0, total: 0,
  }));
  const { errorMessage, executeBulkTrust, lastResult, reset } = useSourceUserBulkOperation({
    bulkUpdateActivitySourceUserTrust: bulkUpdate,
  });

  await executeBulkTrust({ reason: 'test', trustState: 'trusted', usernames: ['peer-1'] });
  assert.ok(lastResult.value !== null);

  reset();
  assert.equal(lastResult.value, null);
  assert.equal(errorMessage.value, '');
});
