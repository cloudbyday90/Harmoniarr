import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  createAdminRecoveryService,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
} from '../../src/server/recovery/admin-recovery-service.js';

test('generateRecoveryCode produces HARM-prefixed code with correct format', () => {
  const code = generateRecoveryCode();
  assert.ok(code.startsWith('HARM-'), 'code should start with HARM-');
  const segments = code.split('-');
  assert.equal(segments.length, 4, 'code should have 4 segments (HARM + 3 groups)');
  assert.equal(segments[0], 'HARM', 'first segment should be HARM');
  for (let i = 1; i < segments.length; i++) {
    assert.equal(segments[i].length, 4, `segment ${i} should be 4 characters`);
  }
});

test('generateRecoveryCode uses unambiguous charset', () => {
  const ambiguousChars = /[0O1I]/;
  for (let i = 0; i < 20; i++) {
    const code = generateRecoveryCode();
    const dataSegments = code.slice(5);
    assert.equal(ambiguousChars.test(dataSegments), false, `code should not contain ambiguous chars: ${code}`);
  }
});

test('generateRecoveryCode produces unique codes', () => {
  const codes = new Set();
  for (let i = 0; i < 50; i++) {
    codes.add(generateRecoveryCode());
  }
  assert.equal(codes.size, 50, 'all codes should be unique');
});

test('hashRecoveryCode produces deterministic SHA-256 hex digest', () => {
  const code = 'HARM-ABCD-EFGH-JKLM';
  const hash1 = hashRecoveryCode(code);
  const hash2 = hashRecoveryCode(code);
  assert.equal(hash1, hash2, 'same code should produce same hash');
  assert.equal(hash1.length, 64, 'SHA-256 hex should be 64 chars');
  assert.match(hash1, /^[0-9a-f]{64}$/, 'hash should be hex-encoded');
});

test('hashRecoveryCode produces different hashes for different codes', () => {
  const hash1 = hashRecoveryCode('HARM-AAAA-BBBB-CCCC');
  const hash2 = hashRecoveryCode('HARM-DDDD-EEEE-FFFF');
  assert.notEqual(hash1, hash2, 'different codes should produce different hashes');
});

test('verifyRecoveryCode returns true for correct code', () => {
  const code = 'HARM-TEST-CODE-1234';
  const hash = hashRecoveryCode(code);
  assert.equal(verifyRecoveryCode(code, hash), true);
});

test('verifyRecoveryCode returns false for wrong code', () => {
  const hash = hashRecoveryCode('HARM-CORRECT-CODE-1234');
  assert.equal(verifyRecoveryCode('HARM-WRONG-CODE-5678', hash), false);
});

test('verifyRecoveryCode returns false for malformed hash', () => {
  assert.equal(verifyRecoveryCode('HARM-TEST-CODE-1234', 'shorthash'), false);
});

function createMockStore(overrides = {}) {
  let activeRun = null;
  const runs = new Map();
  let revokedSessionCount = 0;

  return {
    async getActiveArmedRun() { return activeRun; },
    async insertRecoveryRun(input) {
      const run = {
        id: randomBytes(8).toString('hex'),
        status: 'armed',
        armedVia: input.armedVia ?? 'harmoniarrctl',
        armedAt: new Date().toISOString(),
        expiresAt: input.expiresAt?.toISOString?.() ?? input.expiresAt,
        invalidAttemptCount: 0,
        maxAttempts: input.maxAttempts ?? 5,
        completedAt: null,
        cancelledAt: null,
        createdAdminUserId: null,
        completedFromIp: null,
        completedUserAgent: null,
        reason: input.reason ?? null,
        details: null,
        createdAt: new Date().toISOString(),
        recoveryCodeHash: input.recoveryCodeHash,
        ...overrides.insertResult,
      };
      runs.set(run.id, run);
      activeRun = run;
      return run;
    },
    async incrementInvalidAttemptCount({ runId }) {
      const run = runs.get(runId);
      if (run) {
        run.invalidAttemptCount++;
      }
      return run;
    },
    async invalidateRecoveryRun({ runId }) {
      const run = runs.get(runId);
      if (run) {
        run.status = 'invalidated';
        activeRun = null;
      }
      return run;
    },
    async completeRecoveryRun({ runId, createdAdminUserId, completedFromIp, completedUserAgent }) {
      const run = runs.get(runId);
      if (run) {
        run.status = 'completed';
        run.completedAt = new Date().toISOString();
        run.createdAdminUserId = createdAdminUserId;
        run.completedFromIp = completedFromIp;
        run.completedUserAgent = completedUserAgent;
        activeRun = null;
      }
      return run;
    },
    async cancelRecoveryRun({ runId, reason }) {
      const run = runs.get(runId);
      if (run) {
        run.status = 'cancelled';
        run.cancelledAt = new Date().toISOString();
        if (reason) run.reason = reason;
        activeRun = null;
      }
      return run;
    },
    async expireStaleArmedRuns() { return []; },
    async revokeAllInteractiveSessions() {
      revokedSessionCount++;
      return 3;
    },
    getRevokedSessionCount: () => revokedSessionCount,
    setActiveRun(run) { activeRun = run; runs.set(run.id, run); },
    ...overrides,
  };
}

function createMockLockService(overrides = {}) {
  let activeLocks = [];
  let acquiredLock = null;

  return {
    async listActiveMaintenanceLocks() { return activeLocks; },
    async acquireMaintenanceLock(input) {
      acquiredLock = { id: 'lock-1', lockType: input.lockType, status: 'active' };
      return acquiredLock;
    },
    async releaseMaintenanceLock() { acquiredLock = null; },
    setActiveLocks(locks) { activeLocks = locks; },
    getAcquiredLock: () => acquiredLock,
    ...overrides,
  };
}

function createTestDeps(overrides = {}) {
  const auditEvents = [];
  const createdUsers = [];

  const store = createMockStore(overrides.storeOverrides);
  const lockService = createMockLockService(overrides.lockOverrides);

  const poolMock = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE app_users')) {
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes('INSERT INTO app_users')) {
        const userId = randomBytes(8).toString('hex');
        createdUsers.push({ id: userId, username: params[0] });
        return { rows: [{ id: userId }] };
      }
      return { rows: [] };
    },
  };

  const service = createAdminRecoveryService({
    adminRecoveryStore: store,
    maintenanceLockService: lockService,
    recordAuditEventFn: async (event) => { auditEvents.push(event); },
    getPoolFn: () => poolMock,
    hashPasswordFn: async (pw) => `hashed_${pw}`,
    findUserByUsernameFn: async () => null,
    normalizeUsernameFn: (u) => u.trim().toLowerCase(),
    validatePasswordFn: (p) => p,
  });

  return { service, store, lockService, auditEvents, createdUsers };
}

test('armBootstrapAdminRecovery creates armed run and returns plaintext code', async () => {
  const { service, auditEvents } = createTestDeps();

  const result = await service.armBootstrapAdminRecovery();

  assert.equal(result.status, 'armed');
  assert.ok(result.recoveryCode.startsWith('HARM-'), 'should return plaintext recovery code');
  assert.ok(result.expiresAt, 'should return expiry time');
  assert.ok(result.runId, 'should return run id');
  assert.equal(result.replacedExistingRun, false);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].eventType, 'bootstrap_admin_recovery_armed');
  assert.equal(auditEvents[0].entityType, 'admin_recovery_run');
});

test('armBootstrapAdminRecovery rejects when already armed without force', async () => {
  const { service } = createTestDeps();

  await service.armBootstrapAdminRecovery();

  await assert.rejects(
    () => service.armBootstrapAdminRecovery(),
    { code: 'RECOVERY_ALREADY_ARMED' },
  );
});

test('armBootstrapAdminRecovery replaces existing run with force', async () => {
  const { service, auditEvents } = createTestDeps();

  const first = await service.armBootstrapAdminRecovery();
  const second = await service.armBootstrapAdminRecovery({ force: true });

  assert.equal(second.replacedExistingRun, true);
  assert.notEqual(second.runId, first.runId);

  const cancelEvent = auditEvents.find((e) => e.eventType === 'bootstrap_admin_recovery_cancelled');
  assert.ok(cancelEvent, 'should record cancellation audit event');
  assert.equal(cancelEvent.details.replacedByForceArm, true);
});

test('armBootstrapAdminRecovery rejects when conflicting maintenance locks exist', async () => {
  const { service, lockService } = createTestDeps();

  lockService.setActiveLocks([{ id: 'lock-1', lockType: 'restore', status: 'active' }]);

  await assert.rejects(
    () => service.armBootstrapAdminRecovery(),
    { code: 'RECOVERY_LOCK_CONFLICT' },
  );
});

test('armBootstrapAdminRecovery clamps TTL to valid range', async () => {
  const { service } = createTestDeps();

  const result = await service.armBootstrapAdminRecovery({ ttlMinutes: 60 });

  const expiresAt = new Date(result.expiresAt);
  const maxAllowed = new Date(Date.now() + 30 * 60 * 1000 + 5000);
  assert.ok(expiresAt <= maxAllowed, 'TTL should be clamped to 30 minutes max');
});

test('armBootstrapAdminRecovery stores only hashed code', async () => {
  const { service, store } = createTestDeps();

  const result = await service.armBootstrapAdminRecovery();

  const activeRun = await store.getActiveArmedRun();
  assert.equal(activeRun.recoveryCodeHash, hashRecoveryCode(result.recoveryCode));
  assert.ok(!JSON.stringify(activeRun).includes(result.recoveryCode), 'plaintext code should not appear in stored run');
});

test('getBootstrapAdminRecoveryStatus returns inactive when no run exists', async () => {
  const { service } = createTestDeps();

  const status = await service.getBootstrapAdminRecoveryStatus();

  assert.deepEqual(status, { recoveryAvailable: false });
});

test('getBootstrapAdminRecoveryStatus returns armed run details', async () => {
  const { service } = createTestDeps();

  await service.armBootstrapAdminRecovery();
  const status = await service.getBootstrapAdminRecoveryStatus();

  assert.equal(status.recoveryAvailable, true);
  assert.equal(status.status, 'armed');
  assert.equal(status.remainingAttempts, 5);
  assert.equal(status.blockedByLock, false);
  assert.ok(status.expiresAt);
  assert.ok(status.runId);
});

test('getBootstrapAdminRecoveryStatus reports blockedByLock when conflicting locks exist', async () => {
  const { service, lockService } = createTestDeps();

  await service.armBootstrapAdminRecovery();
  lockService.setActiveLocks([{ id: 'lock-1', lockType: 'restore', status: 'active' }]);

  const status = await service.getBootstrapAdminRecoveryStatus();
  assert.equal(status.blockedByLock, true);
});

test('getBootstrapAdminRecoveryStatus does not expose recovery code hash', async () => {
  const { service } = createTestDeps();

  await service.armBootstrapAdminRecovery();
  const status = await service.getBootstrapAdminRecoveryStatus();

  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes('recoveryCodeHash'), 'should not expose hash');
  assert.ok(!serialized.includes('recovery_code'), 'should not expose code-related fields');
});

test('cancelBootstrapAdminRecovery rejects when no active run', async () => {
  const { service } = createTestDeps();

  await assert.rejects(
    () => service.cancelBootstrapAdminRecovery({ force: true }),
    { code: 'RECOVERY_NOT_ARMED' },
  );
});

test('cancelBootstrapAdminRecovery requires force flag', async () => {
  const { service } = createTestDeps();

  await service.armBootstrapAdminRecovery();

  await assert.rejects(
    () => service.cancelBootstrapAdminRecovery(),
    { code: 'RECOVERY_FORCE_REQUIRED' },
  );
});

test('cancelBootstrapAdminRecovery cancels active run with force', async () => {
  const { service, auditEvents } = createTestDeps();

  await service.armBootstrapAdminRecovery();
  const result = await service.cancelBootstrapAdminRecovery({
    force: true,
    reason: 'operator cancelled',
  });

  assert.equal(result.status, 'cancelled');
  assert.ok(result.cancelledAt);

  const cancelEvent = auditEvents.find((e) => e.eventType === 'bootstrap_admin_recovery_cancelled');
  assert.ok(cancelEvent);
  assert.equal(cancelEvent.details.reason, 'operator cancelled');

  const status = await service.getBootstrapAdminRecoveryStatus();
  assert.equal(status.recoveryAvailable, false);
});

test('completeBootstrapAdminRecovery succeeds with correct code', async () => {
  const { service, auditEvents, createdUsers } = createTestDeps();

  const armed = await service.armBootstrapAdminRecovery();
  const result = await service.completeBootstrapAdminRecovery({
    confirmPassword: 'test-password-123',
    password: 'test-password-123',
    recoveryCode: armed.recoveryCode,
    requestMetadata: { ipAddress: '192.168.1.1', userAgent: 'TestBrowser' },
    username: 'recoveredadmin',
  });

  assert.equal(result.success, true);
  assert.equal(result.requiresLogin, true);
  assert.ok(result.recoveryChecklist);
  assert.equal(result.recoveryChecklist.length, 3);

  assert.equal(createdUsers.length, 1);
  assert.equal(createdUsers[0].username, 'recoveredadmin');

  const completedEvent = auditEvents.find((e) => e.eventType === 'bootstrap_admin_recovery_completed');
  assert.ok(completedEvent);
  assert.equal(completedEvent.ipAddress, '192.168.1.1');

  const revokedEvent = auditEvents.find((e) => e.eventType === 'sessions_revoked_after_recovery');
  assert.ok(revokedEvent);
  assert.equal(revokedEvent.details.revokedSessionCount, 3);
});

test('completeBootstrapAdminRecovery rejects with wrong code', async () => {
  const { service } = createTestDeps();

  await service.armBootstrapAdminRecovery();

  await assert.rejects(
    () => service.completeBootstrapAdminRecovery({
      confirmPassword: 'test-password-123',
      password: 'test-password-123',
      recoveryCode: 'HARM-WRONG-CODE-1234',
      username: 'admin',
    }),
    { code: 'RECOVERY_CODE_INVALID_OR_EXPIRED' },
  );
});

test('completeBootstrapAdminRecovery invalidates run after max invalid attempts', async () => {
  const { service, auditEvents } = createTestDeps();

  await service.armBootstrapAdminRecovery();

  for (let i = 0; i < 5; i++) {
    try {
      await service.completeBootstrapAdminRecovery({
        confirmPassword: 'test-password-123',
        password: 'test-password-123',
        recoveryCode: 'HARM-WRONG-CODE-1234',
        username: 'admin',
      });
    } catch (error) {
      if (i === 4) {
        assert.equal(error.code, 'RECOVERY_ATTEMPT_THRESHOLD_REACHED');
      }
    }
  }

  const invalidatedEvent = auditEvents.find((e) => e.eventType === 'bootstrap_admin_recovery_invalidated');
  assert.ok(invalidatedEvent);
  assert.equal(invalidatedEvent.details.invalidAttemptCount, 5);

  const status = await service.getBootstrapAdminRecoveryStatus();
  assert.equal(status.recoveryAvailable, false);
});

test('completeBootstrapAdminRecovery rejects when no active run', async () => {
  const { service } = createTestDeps();

  await assert.rejects(
    () => service.completeBootstrapAdminRecovery({
      confirmPassword: 'test-password-123',
      password: 'test-password-123',
      recoveryCode: 'HARM-TEST-CODE-1234',
      username: 'admin',
    }),
    { code: 'RECOVERY_NOT_ARMED' },
  );
});

test('completeBootstrapAdminRecovery rejects when conflicting locks exist', async () => {
  const { service, lockService } = createTestDeps();

  const armed = await service.armBootstrapAdminRecovery();
  lockService.setActiveLocks([{ id: 'lock-1', lockType: 'restore', status: 'active' }]);

  await assert.rejects(
    () => service.completeBootstrapAdminRecovery({
      confirmPassword: 'test-password-123',
      password: 'test-password-123',
      recoveryCode: armed.recoveryCode,
      username: 'admin',
    }),
    { code: 'RECOVERY_LOCK_CONFLICT' },
  );
});

test('completeBootstrapAdminRecovery rejects missing fields', async () => {
  const { service } = createTestDeps();

  await assert.rejects(
    () => service.completeBootstrapAdminRecovery({
      password: 'test-password-123',
      username: 'admin',
    }),
    { code: 'RECOVERY_INVALID_ARGUMENT' },
  );
});

test('completeBootstrapAdminRecovery rejects password mismatch', async () => {
  const { service } = createTestDeps();

  const armed = await service.armBootstrapAdminRecovery();

  await assert.rejects(
    () => service.completeBootstrapAdminRecovery({
      confirmPassword: 'different-password',
      password: 'test-password-123',
      recoveryCode: armed.recoveryCode,
      username: 'admin',
    }),
    { code: 'RECOVERY_INVALID_ARGUMENT' },
  );
});

test('completeBootstrapAdminRecovery re-enables existing user', async () => {
  const existingUser = { id: 'existing-user-1', username: 'admin', is_disabled: true };
  let updateCalled = false;

  createTestDeps({
    storeOverrides: {},
  });

  const poolMock = {
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO app_users')) {
        return { rows: [{ id: 'new-user-1' }] };
      }
      if (sql.includes('UPDATE app_users')) {
        updateCalled = true;
        return { rows: [{ id: params[0] }] };
      }
      return { rows: [] };
    },
  };

  const existingUserService = createAdminRecoveryService({
    adminRecoveryStore: createMockStore(),
    maintenanceLockService: createMockLockService(),
    recordAuditEventFn: async () => {},
    getPoolFn: () => poolMock,
    hashPasswordFn: async (pw) => `hashed_${pw}`,
    findUserByUsernameFn: async () => existingUser,
    normalizeUsernameFn: (u) => u.trim().toLowerCase(),
    validatePasswordFn: (p) => p,
  });

  const armed = await existingUserService.armBootstrapAdminRecovery();
  const result = await existingUserService.completeBootstrapAdminRecovery({
    confirmPassword: 'new-password-123',
    password: 'new-password-123',
    recoveryCode: armed.recoveryCode,
    username: 'admin',
  });

  assert.equal(result.success, true);
  assert.ok(updateCalled, 'should update existing user instead of creating new one');
});

test('completeBootstrapAdminRecovery acquires and releases admin_recovery lock', async () => {
  const { service, lockService } = createTestDeps();

  const armed = await service.armBootstrapAdminRecovery();
  await service.completeBootstrapAdminRecovery({
    confirmPassword: 'test-password-123',
    password: 'test-password-123',
    recoveryCode: armed.recoveryCode,
    username: 'admin',
  });

  assert.equal(lockService.getAcquiredLock(), null, 'lock should be released after completion');
});
