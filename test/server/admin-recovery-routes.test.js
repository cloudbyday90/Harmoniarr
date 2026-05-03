import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerAdminRecoveryRoutes } from '../../src/server/routes/admin-recovery-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAdminRecoveryRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAdminRecoveryRoutes(app, {
      completeBootstrapAdminRecovery: async ({
        confirmPassword,
        password,
        recoveryCode,
        requestMetadata,
        username,
      }) => ({
        received: {
          confirmPassword,
          password,
          recoveryCode,
          requestMetadata,
          username,
        },
        requiresLogin: true,
        success: true,
      }),
      getBootstrapAdminRecoveryStatus: async () => ({
        blockedByLock: false,
        expiresAt: '2026-05-03T00:15:00.000Z',
        recoveryAvailable: true,
        remainingAttempts: 5,
        runId: 'recovery-run-1',
        status: 'armed',
      }),
      getRequestMetadata: () => ({
        ipAddress: '127.0.0.1',
        userAgent: 'route-test-agent',
      }),
      ...overrides,
    });
  });
}

test('admin recovery status route is public and returns the shared recovery payload', async (t) => {
  const getBootstrapAdminRecoveryStatus = t.mock.fn(async () => ({
    blockedByLock: true,
    expiresAt: '2026-05-03T00:15:00.000Z',
    recoveryAvailable: true,
    remainingAttempts: 4,
    runId: 'recovery-run-22',
    status: 'armed',
  }));
  const app = createAdminRecoveryRouteTestApp({
    getBootstrapAdminRecoveryStatus,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/bootstrap-admin/status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getBootstrapAdminRecoveryStatus.mock.callCount(), 1);
    assert.equal(payload.recoveryAvailable, true);
    assert.equal(payload.blockedByLock, true);
    assert.equal(payload.runId, 'recovery-run-22');
  });
});

test('admin recovery completion route is public and forwards request metadata plus form fields', async (t) => {
  const getRequestMetadata = t.mock.fn((request) => ({
    ipAddress: request.headers['x-forwarded-for'],
    userAgent: request.headers['user-agent'],
  }));
  const completeBootstrapAdminRecovery = t.mock.fn(async ({
    confirmPassword,
    password,
    recoveryCode,
    requestMetadata,
    username,
  }) => ({
    recoveryChecklist: ['Log in again'],
    received: {
      confirmPassword,
      password,
      recoveryCode,
      requestMetadata,
      username,
    },
    requiresLogin: true,
    success: true,
  }));
  const app = createAdminRecoveryRouteTestApp({
    completeBootstrapAdminRecovery,
    getRequestMetadata,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/bootstrap-admin/complete`, {
      body: JSON.stringify({
        confirmPassword: 'RecoveredPass123!',
        password: 'RecoveredPass123!',
        recoveryCode: 'HARM-ABCD-EFGH-JKLM',
        username: 'recoveredadmin',
      }),
      headers: {
        'content-type': 'application/json',
        'user-agent': 'RecoveryRouteTest/1.0',
        'x-forwarded-for': '203.0.113.22',
      },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getRequestMetadata.mock.callCount(), 1);
    assert.equal(completeBootstrapAdminRecovery.mock.callCount(), 1);
    assert.deepEqual(completeBootstrapAdminRecovery.mock.calls[0].arguments, [{
      confirmPassword: 'RecoveredPass123!',
      password: 'RecoveredPass123!',
      recoveryCode: 'HARM-ABCD-EFGH-JKLM',
      requestMetadata: {
        ipAddress: '203.0.113.22',
        userAgent: 'RecoveryRouteTest/1.0',
      },
      username: 'recoveredadmin',
    }]);
    assert.equal(payload.success, true);
    assert.equal(payload.received.requestMetadata.ipAddress, '203.0.113.22');
  });
});

test('admin recovery routes preserve shared api errors from the recovery service', async () => {
  const app = createAdminRecoveryRouteTestApp({
    completeBootstrapAdminRecovery: async () => {
      throw createApiError(409, 'RECOVERY_LOCK_CONFLICT', 'Recovery cannot complete while conflicting maintenance locks are active');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/recovery/bootstrap-admin/complete`, {
      body: JSON.stringify({
        confirmPassword: 'RecoveredPass123!',
        password: 'RecoveredPass123!',
        recoveryCode: 'HARM-ABCD-EFGH-JKLM',
        username: 'recoveredadmin',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.error.code, 'RECOVERY_LOCK_CONFLICT');
  });
});
