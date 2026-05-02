import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountSecurityService } from '../../src/server/account-security-service.js';

function createPool(t, queryResults = []) {
  const query = t.mock.fn(async () => queryResults.shift() ?? { rowCount: 0, rows: [] });
  return {
    query,
  };
}

test('account security service lists active sessions with the current session first', async (t) => {
  const pool = createPool(t, [{
    rows: [
      {
        id: 'older-session',
        issued_at: '2026-05-01T10:00:00.000Z',
        issued_ip: '198.51.100.10',
        issued_user_agent: 'OlderSession/1.0',
        last_used_at: '2026-05-01T11:00:00.000Z',
        expires_at: '2026-05-15T10:00:00.000Z',
      },
      {
        id: 'current-session',
        issued_at: '2026-05-01T12:00:00.000Z',
        issued_ip: '203.0.113.20',
        issued_user_agent: 'CurrentSession/1.0',
        last_used_at: '2026-05-01T12:30:00.000Z',
        expires_at: '2026-05-15T12:00:00.000Z',
      },
    ],
  }]);
  const service = createAccountSecurityService({
    getPoolFn: () => pool,
  });

  const sessions = await service.listActiveSessions({
    session: {
      appUserId: 'user-1',
      refreshTokenId: 'current-session',
    },
  });

  assert.equal(pool.query.mock.callCount(), 1);
  assert.equal(sessions[0].id, 'current-session');
  assert.equal(sessions[0].isCurrent, true);
  assert.equal(sessions[1].id, 'older-session');
  assert.equal(sessions[1].isCurrent, false);
});

test('account security service changes password, clears must-change state, and issues a new session', async (t) => {
  const pool = createPool(t, [
    {
      rows: [{
        id: 'user-1',
        username: 'admin',
        role: 'admin',
        password_hash: 'stored-hash',
        must_change_password: true,
        last_login_at: '2026-05-01T11:00:00.000Z',
      }],
    },
    {
      rows: [{
        id: 'user-1',
        username: 'admin',
        role: 'admin',
        must_change_password: false,
        last_login_at: '2026-05-01T11:00:00.000Z',
      }],
    },
    {
      rowCount: 2,
      rows: [],
    },
  ]);
  const issueSessionFn = t.mock.fn(async () => ({
    csrfToken: 'csrf-next',
    refreshToken: 'refresh-next',
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const verifyPasswordFn = t.mock.fn(async (candidate) => candidate === 'current-password');
  const service = createAccountSecurityService({
    getPoolFn: () => pool,
    hashPasswordFn: t.mock.fn(async () => 'next-password-hash'),
    issueSessionFn,
    recordAuditEventFn,
    validatePasswordFn: (value) => value,
    verifyPasswordFn,
  });

  const result = await service.changePassword({
    currentPassword: 'current-password',
    newPassword: 'next-password',
    requestMetadata: { ipAddress: '203.0.113.50', userAgent: 'AccountSecurityTest/1.0' },
    session: { appUserId: 'user-1' },
  });

  assert.equal(pool.query.mock.callCount(), 3);
  assert.equal(issueSessionFn.mock.callCount(), 1);
  assert.equal(result.user.must_change_password, false);
  assert.equal(result.issuedSession.refreshToken, 'refresh-next');
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0].details, {
    revokedSessionCount: 2,
  });
  assert.deepEqual(issueSessionFn.mock.calls[0].arguments[0], {
    requestMetadata: { ipAddress: '203.0.113.50', userAgent: 'AccountSecurityTest/1.0' },
    userId: 'user-1',
  });
  assert.equal(verifyPasswordFn.mock.callCount(), 2);
});

test('account security service lists recent activity through the shared audit read service', async (t) => {
  const auditReadService = {
    listRecentAuditEvents: t.mock.fn(async () => ([{
      entityId: 'run-22',
      entityType: 'operation_run',
      eventType: 'artwork_cleanup_started',
      id: 'audit-1',
      occurredAt: '2026-05-01T16:10:00.000Z',
      summary: 'Artwork cleanup started',
    }])),
  };
  const service = createAccountSecurityService({
    auditReadService,
    getPoolFn: () => createPool(t),
  });

  const events = await service.listRecentActivity({
    limit: 5,
    session: {
      appUserId: 'user-1',
    },
  });

  assert.equal(auditReadService.listRecentAuditEvents.mock.callCount(), 1);
  assert.deepEqual(auditReadService.listRecentAuditEvents.mock.calls[0].arguments[0], {
    actorUserId: 'user-1',
    limit: 5,
  });
  assert.equal(events[0].id, 'audit-1');
});

test('account security service refuses to revoke the current session via the management route', async (t) => {
  const service = createAccountSecurityService({
    getPoolFn: () => createPool(t),
  });

  await assert.rejects(
    () => service.revokeSession({
      refreshTokenId: 'current-session',
      requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
      session: { appUserId: 'user-1', refreshTokenId: 'current-session' },
    }),
    (error) => error?.status === 400
      && error?.code === 'current_session_revoke_unsupported'
      && error?.message === 'Use logout to end the current session',
  );
});