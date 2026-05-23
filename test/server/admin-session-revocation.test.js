import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountSecurityService } from '../../src/server/account-security-service.js';

function createPool(t, queryResults = []) {
  const query = t.mock.fn(async () => queryResults.shift() ?? { rowCount: 0, rows: [] });
  return { query };
}

test('adminRevokeUserSession revokes a single active session for a target user', async (t) => {
  const pool = createPool(t, [
    {
      rows: [{
        id: 'session-1',
        app_user_id: 'target-user',
        username: 'bob',
      }],
    },
  ]);
  const revokeRefreshTokenFn = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createAccountSecurityService({
    getPoolFn: () => pool,
    recordAuditEventFn,
    revokeRefreshTokenFn,
  });

  const result = await service.adminRevokeUserSession({
    adminUserId: 'admin-1',
    refreshTokenId: 'session-1',
    requestMetadata: { ipAddress: '10.0.0.1', userAgent: 'AdminBrowser/1.0' },
  });

  assert.equal(revokeRefreshTokenFn.mock.callCount(), 1);
  assert.deepEqual(revokeRefreshTokenFn.mock.calls[0].arguments, ['session-1', 'admin_revoked']);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'admin_session_revoked');
  assert.equal(result.revokedSessionId, 'session-1');
  assert.equal(result.targetUserId, 'target-user');
  assert.equal(result.targetUsername, 'bob');
});

test('adminRevokeUserSession throws 404 when session not found', async (t) => {
  const pool = createPool(t, [{ rows: [] }]);
  const service = createAccountSecurityService({
    getPoolFn: () => pool,
  });

  await assert.rejects(
    () => service.adminRevokeUserSession({
      adminUserId: 'admin-1',
      refreshTokenId: 'nonexistent',
      requestMetadata: {},
    }),
    (error) => error?.status === 404 && error?.code === 'session_not_found',
  );
});

test('adminRevokeAllUserSessions revokes all active sessions for a target user', async (t) => {
  const pool = createPool(t, [
    { rows: [{ username: 'alice' }] },
    { rowCount: 3, rows: [] },
  ]);
  const revokeRefreshTokenFn = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createAccountSecurityService({
    getPoolFn: () => pool,
    recordAuditEventFn,
    revokeRefreshTokenFn,
  });

  const result = await service.adminRevokeAllUserSessions({
    adminUserId: 'admin-1',
    requestMetadata: { ipAddress: '10.0.0.1', userAgent: 'AdminBrowser/1.0' },
    targetUserId: 'user-1',
  });

  assert.equal(result.revokedSessionCount, 3);
  assert.equal(result.targetUserId, 'user-1');
  assert.equal(result.targetUsername, 'alice');
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'admin_sessions_revoked');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].summary, 'Admin revoked all sessions for user "alice" (3 sessions)');
});

test('adminRevokeAllUserSessions throws 404 when user not found', async (t) => {
  const pool = createPool(t, [{ rows: [] }]);
  const service = createAccountSecurityService({
    getPoolFn: () => pool,
  });

  await assert.rejects(
    () => service.adminRevokeAllUserSessions({
      adminUserId: 'admin-1',
      requestMetadata: {},
      targetUserId: 'nonexistent',
    }),
    (error) => error?.status === 404 && error?.code === 'user_not_found',
  );
});
