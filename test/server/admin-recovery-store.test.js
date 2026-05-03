import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminRecoveryStore } from '../../src/server/recovery/admin-recovery-store.js';

function createRecoveryRunRow(overrides = {}) {
  return {
    armed_at: new Date('2026-05-03T00:00:00.000Z'),
    armed_via: 'harmoniarrctl',
    cancelled_at: null,
    completed_at: null,
    completed_from_ip: null,
    completed_user_agent: null,
    created_admin_user_id: null,
    created_at: new Date('2026-05-03T00:00:00.000Z'),
    details_json: null,
    expires_at: new Date('2026-05-03T00:15:00.000Z'),
    id: 'recovery-run-1',
    invalid_attempt_count: 0,
    max_attempts: 5,
    reason: 'operator lockout',
    recovery_code_hash: 'abc123hash',
    status: 'armed',
    ...overrides,
  };
}

test('admin recovery store returns the internal recoveryCodeHash for active armed runs', async () => {
  const pool = {
    async query() {
      return {
        rows: [createRecoveryRunRow()],
      };
    },
  };
  const store = createAdminRecoveryStore({
    getPoolFn: () => pool,
  });

  const activeRun = await store.getActiveArmedRun();

  assert.equal(activeRun.id, 'recovery-run-1');
  assert.equal(activeRun.recoveryCodeHash, 'abc123hash');
  assert.equal(activeRun.status, 'armed');
});

test('admin recovery store skips database reads when run ids are blank', async () => {
  let queryCount = 0;
  const pool = {
    async query() {
      queryCount++;
      return { rows: [] };
    },
  };
  const store = createAdminRecoveryStore({
    getPoolFn: () => pool,
  });

  const run = await store.getRecoveryRunById({
    runId: '   ',
  });

  assert.equal(run, null);
  assert.equal(queryCount, 0);
});
