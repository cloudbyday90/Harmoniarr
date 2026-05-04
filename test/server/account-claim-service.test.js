import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAccountClaimService,
  hashClaimCode,
} from '../../src/server/account-claim-service.js';

test('createAccountClaimService issues a claim code and revokes prior active claims', async (t) => {
  const accountClaimStore = {
    insertClaimCode: t.mock.fn(async ({ expiresAt }) => ({
      expiresAt,
      id: 'claim-1',
    })),
    revokeActiveClaimCodesForUser: t.mock.fn(async () => 1),
  };
  const client = {
    query: t.mock.fn(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rowCount: 0, rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }),
    release: t.mock.fn(),
  };
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createAccountClaimService({
    accountClaimStore,
    createClaimCodeFn: () => 'HCLM-ABCD-EFGH-JKLM',
    getAppUserByIdFn: async () => ({ id: 'user-2', isDisabled: false, username: 'listener' }),
    getPoolFn: () => ({ connect: async () => client }),
    recordAuditEventFn,
  });

  const result = await service.issueClaimCode({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.70', userAgent: 'HarmoniarrClaimServiceTest/1.0' },
    ttlMinutes: 30,
    userId: 'user-2',
  });

  assert.equal(result.claimCode, 'HCLM-ABCD-EFGH-JKLM');
  assert.equal(result.replacedExistingClaim, true);
  assert.equal(result.user.username, 'listener');
  assert.equal(accountClaimStore.revokeActiveClaimCodesForUser.mock.callCount(), 1);
  assert.equal(accountClaimStore.insertClaimCode.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_claim_code_issued');
  assert.equal(client.release.mock.callCount(), 1);
});

test('createAccountClaimService completes a valid claim, updates password, and revokes sessions', async (t) => {
  const accountClaimStore = {
    consumeClaimCode: t.mock.fn(async () => ({ id: 'claim-1' })),
    getActiveClaimForUser: t.mock.fn(async () => ({
      claimCodeHash: hashClaimCode('HCLM-ABCD-EFGH-JKLM'),
      id: 'claim-1',
    })),
  };
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rowCount: 0, rows: [] };
    }

    if (String(sql).includes('UPDATE app_users')) {
      return {
        rowCount: 1,
        rows: [{
          id: 'user-2',
          username: 'listener',
        }],
      };
    }

    if (String(sql).includes('UPDATE refresh_tokens')) {
      return { rowCount: 2, rows: [] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });
  const client = {
    query,
    release: t.mock.fn(),
  };
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createAccountClaimService({
    accountClaimStore,
    findUserByLoginIdentifierFn: async () => ({ id: 'user-2', is_disabled: false, username: 'listener' }),
    getPoolFn: () => ({ connect: async () => client }),
    hashPasswordFn: t.mock.fn(async () => 'hashed-password'),
    recordAuditEventFn,
  });

  const result = await service.completeClaim({
    claimCode: 'hclm-abcd-efgh-jklm',
    password: 'claim-password-1234',
    requestMetadata: { ipAddress: '203.0.113.71', userAgent: 'HarmoniarrClaimServiceTest/1.0' },
    username: 'listener',
  });

  assert.deepEqual(result, {
    requiresLogin: true,
    username: 'listener',
  });
  assert.equal(accountClaimStore.getActiveClaimForUser.mock.callCount(), 1);
  assert.equal(accountClaimStore.consumeClaimCode.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_claim_completed');
  assert.equal(client.release.mock.callCount(), 1);
});

test('createAccountClaimService rejects an invalid claim code with a generic error', async () => {
  const service = createAccountClaimService({
    accountClaimStore: {
      getActiveClaimForUser: async () => ({
        claimCodeHash: hashClaimCode('HCLM-ZZZZ-ZZZZ-ZZZZ'),
        id: 'claim-1',
      }),
    },
    findUserByLoginIdentifierFn: async () => ({ id: 'user-2', is_disabled: false, username: 'listener' }),
    getPoolFn: () => ({
      connect: async () => ({
        query: async (sql) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }

          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      }),
    }),
  });

  await assert.rejects(
    () => service.completeClaim({
      claimCode: 'HCLM-ABCD-EFGH-JKLM',
      password: 'claim-password-1234',
      requestMetadata: { ipAddress: '203.0.113.72', userAgent: 'HarmoniarrClaimServiceTest/1.0' },
      username: 'listener',
    }),
    (error) => error?.status === 401
      && error?.code === 'app_user_claim_invalid_or_expired'
      && error?.message === 'Claim code or user identity is incorrect',
  );
});