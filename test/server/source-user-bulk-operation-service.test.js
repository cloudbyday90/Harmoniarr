import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserBulkOperationService } from '../../src/server/activity/source-user-bulk-operation-service.js';

test('bulkUpdateSourceUserTrust applies trust overrides to multiple users', async () => {
  const updated = [];
  const service = createSourceUserBulkOperationService({
    updateSourceUserTrust: async (params) => {
      updated.push(params.username);
      return { sourceUser: { trustState: params.trustState, username: params.username } };
    },
  });

  const result = await service.bulkUpdateSourceUserTrust({
    actorUserId: 'admin-1',
    reason: 'Batch trust',
    trustState: 'trusted',
    usernames: ['peer-1', 'peer-2', 'peer-3'],
  });

  assert.equal(result.total, 3);
  assert.equal(result.succeeded, 3);
  assert.equal(result.failed, 0);
  assert.deepEqual(updated, ['peer-1', 'peer-2', 'peer-3']);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[0].username, 'peer-1');
});

test('bulkUpdateSourceUserTrust reports per-item failures without aborting', async () => {
  const service = createSourceUserBulkOperationService({
    updateSourceUserTrust: async (params) => {
      if (params.username === 'bad-peer') {
        const error = new Error('Blocked');
        error.status = 409;
        error.code = 'source_user_trust_blocked_use_blocklist';
        throw error;
      }

      return { sourceUser: { trustState: params.trustState, username: params.username } };
    },
  });

  const result = await service.bulkUpdateSourceUserTrust({
    reason: 'Batch trust',
    trustState: 'trusted',
    usernames: ['good-peer', 'bad-peer', 'other-peer'],
  });

  assert.equal(result.total, 3);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[1].ok, false);
  assert.equal(result.results[1].username, 'bad-peer');
  assert.equal(result.results[1].error.code, 'source_user_trust_blocked_use_blocklist');
  assert.equal(result.results[1].error.status, 409);
});

test('bulkBlockSourceUsers blocks multiple users', async () => {
  const blocked = [];
  const service = createSourceUserBulkOperationService({
    blockSourceUser: async (params) => {
      blocked.push(params.username);
      return { sourceUser: { isBlocked: true, username: params.username } };
    },
  });

  const result = await service.bulkBlockSourceUsers({
    actorUserId: 'admin-1',
    reason: 'Spam ring',
    usernames: ['spammer-1', 'spammer-2'],
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(blocked, ['spammer-1', 'spammer-2']);
});

test('bulkUpdateSourceUserTrust validates usernames is a non-empty array', async () => {
  const service = createSourceUserBulkOperationService();

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ reason: 'test', trustState: 'trusted', usernames: 'not-array' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ reason: 'test', trustState: 'trusted', usernames: [] }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('bulkUpdateSourceUserTrust validates usernames max batch size', async () => {
  const service = createSourceUserBulkOperationService();
  const tooMany = Array.from({ length: 51 }, (_, i) => `peer-${i}`);

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ reason: 'test', trustState: 'trusted', usernames: tooMany }),
    (error) => error?.status === 400 && /50 entries or less/.test(error?.message),
  );
});

test('bulkUpdateSourceUserTrust validates reason is required', async () => {
  const service = createSourceUserBulkOperationService();

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ trustState: 'trusted', usernames: ['peer-1'] }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('bulkUpdateSourceUserTrust validates individual usernames are non-empty strings', async () => {
  const service = createSourceUserBulkOperationService();

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ reason: 'test', trustState: 'trusted', usernames: ['peer-1', 123] }),
    (error) => error?.status === 400 && /usernames\[1\]/.test(error?.message),
  );

  await assert.rejects(
    () => service.bulkUpdateSourceUserTrust({ reason: 'test', trustState: 'trusted', usernames: ['peer-1', '  '] }),
    (error) => error?.status === 400 && /usernames\[1\]/.test(error?.message),
  );
});
