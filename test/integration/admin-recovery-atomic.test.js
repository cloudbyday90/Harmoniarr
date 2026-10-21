/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { recordAuditEvent } from '../../src/server/audit.js';
import { createAdminRecoveryService } from '../../src/server/recovery/admin-recovery-service.js';
import { createAdminRecoveryStore } from '../../src/server/recovery/admin-recovery-store.js';
import { createAdminRecoveryAccountStore } from '../../src/server/recovery/admin-recovery-account-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { hashPassword, verifyPassword } from '../../src/server/security.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const form = (code, username = 'recoveredadmin') => ({ recoveryCode: code, username, password: 'RecoveredPass123!', confirmPassword: 'RecoveredPass123!' });
const settled = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function projection(pool, runId) {
  const users = (await pool.query('SELECT to_jsonb(u) AS row FROM app_users u ORDER BY id')).rows;
  const sessions = (await pool.query('SELECT to_jsonb(s) AS row FROM refresh_tokens s ORDER BY id')).rows;
  const runs = (await pool.query('SELECT to_jsonb(r) AS row FROM admin_recovery_runs r WHERE id=$1', [runId])).rows;
  const audits = (await pool.query('SELECT to_jsonb(a) AS row FROM audit_events a WHERE entity_id=$1 ORDER BY id', [runId])).rows;
  return digest({ users, sessions, runs, audits }); // Never print credentials or their stored hashes.
}
async function row(pool, id) { return (await pool.query('SELECT status, invalid_attempt_count FROM admin_recovery_runs WHERE id=$1', [id])).rows[0]; }
async function scenario(t, name, work) {
  await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
    assert.equal((await bootstrapAdminSession(context.client)).response.status, 201);
    await work(context, scope);
  }), { scenarioName: name });
}
async function waitBlocked(context, scope, holderPid, operation) {
  await withFixturePostgresObserver({ connectionConfig: context.databaseConfig, signal: scope.signal }, async observer => {
    await waitForFixturePostgresBlock({ queryable: observer, holderPid, operation, signal: scope.signal });
  });
}

suite('Atomic recovery against native PostgreSQL', () => {
  before(async () => { runtime = await createIntegrationAppRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('two prepared valid completions wait on one real run row and produce one account/session/audit outcome', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_overlap', async (context, scope) => {
      const pool = context.getPoolFn(); const accounts = createAdminRecoveryAccountStore(); const maintenance = createMaintenanceLockService();
      const both = createFixtureGate({ signal: scope.signal }); const written = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => { both.release(); hold.release(); }); let acquired = 0; let writes = 0;
      const service = createAdminRecoveryService({ maintenanceLockService: { ...maintenance, acquireMaintenanceLock: async options => {
        const lock = await maintenance.acquireMaintenanceLock(options); if (++acquired === 2) both.release(); await both.promise; return lock;
      } }, recoveryAccountStore: { upsertAdminAccount: async options => {
        const id = await accounts.upsertAdminAccount(options); writes++;
        const pid = (await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        written.release({ pid, username: options.username }); await hold.promise; return id;
      } } });
      const armed = await service.armBootstrapAdminRecovery();
      const first = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode, 'winnerone'))));
      const second = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode, 'winnertwo'))));
      const combined = Promise.all([first, second]);
      const holder = await waitForFixtureReady({ ready: written.promise, operation: combined, signal: scope.signal });
      await waitBlocked(context, scope, holder.pid, combined);
      await withFixturePostgresObserver({ connectionConfig: context.databaseConfig, signal: scope.signal }, async observer => {
        const waiters = await observer.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT id FROM admin_recovery_runs%'`, [holder.pid]);
        assert.equal(waiters.rowCount, 1);
      });
      hold.release(); const outcomes = await combined;
      assert.equal(outcomes.filter(result => result.ok).length, 1);
      assert.equal(outcomes.find(result => !result.ok).error.status, 401); assert.equal(writes, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM app_users WHERE username IN ('winnerone','winnertwo')")).rows[0].count, 1);
      assert.equal((await row(pool, armed.runId)).status, 'completed');
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND event_type='bootstrap_admin_recovery_completed'", [armed.runId])).rows[0].count, 1);
      assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user, null);
      await assert.rejects(createAdminRecoveryService().completeBootstrapAdminRecovery(form(armed.recoveryCode)), { status: 401 });
    });
  });

  test('failures after native account/session/run/audit writes roll every authoritative projection back with original Error/null', { timeout: config.scenarioTimeoutMs }, async t => {
    for (const [phase, failure] of [['account', null], ['sessions', new Error('owned session failure')], ['run', null], ['audit', new Error('owned audit failure')]]) {
      await scenario(t, `recovery_atomic_rollback_${phase}`, async context => {
        const store = createAdminRecoveryStore(); const accounts = createAdminRecoveryAccountStore();
        const service = createAdminRecoveryService({
          adminRecoveryStore: { ...store,
            revokeAllInteractiveSessions: async options => { const result = await store.revokeAllInteractiveSessions(options); if (phase === 'sessions') throw failure; return result; },
            completeRecoveryRun: async options => { const result = await store.completeRecoveryRun(options); if (phase === 'run') throw failure; return result; } },
          recoveryAccountStore: { upsertAdminAccount: async options => { const result = await accounts.upsertAdminAccount(options); if (phase === 'account') throw failure; return result; } },
          recordAuditEventFn: async (event, queryable) => { await recordAuditEvent(event, queryable); if (phase === 'audit' && event.eventType === 'sessions_revoked_after_recovery') throw failure; },
        });
        const armed = await service.armBootstrapAdminRecovery(); const prior = await projection(context.getPoolFn(), armed.runId);
        const outcome = await settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode)));
        assert.equal(outcome.ok, false); assert.equal(outcome.error, failure);
        assert.equal(await projection(context.getPoolFn(), armed.runId), prior);
        assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
        assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM maintenance_locks WHERE status='active' AND released_at IS NULL")).rows[0].count, 0);
        if (phase === 'audit') assert.equal((await createAdminRecoveryService().completeBootstrapAdminRecovery(form(armed.recoveryCode))).success, true);
      });
    }
  });

  test('guarded consumption refuses database expiry after account/session writes and rolls those writes back', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_consume_refusal', async context => {
      const store = createAdminRecoveryStore();
      const service = createAdminRecoveryService({ adminRecoveryStore: { ...store, completeRecoveryRun: async options => {
        await options.queryable.query("UPDATE admin_recovery_runs SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1", [options.runId]);
        return store.completeRecoveryRun(options);
      } } });
      const armed = await service.armBootstrapAdminRecovery(); const prior = await projection(context.getPoolFn(), armed.runId);
      await assert.rejects(service.completeBootstrapAdminRecovery(form(armed.recoveryCode)), { status: 401 });
      assert.equal(await projection(context.getPoolFn(), armed.runId), prior);
    });
  });

  test('force rearm while hashing cannot retarget a pending completion to the new run', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_replaced', async (context, scope) => {
      const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const service = createAdminRecoveryService({ hashPasswordFn: async password => { const hash = await hashPassword(password); ready.release(); await hold.promise; return hash; } });
      const armed = await service.armBootstrapAdminRecovery();
      const pending = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode))));
      await waitForFixtureReady({ ready: ready.promise, operation: pending, signal: scope.signal });
      const replacement = await createAdminRecoveryService().armBootstrapAdminRecovery({ force: true });
      hold.release(); assert.equal((await pending).error.status, 401);
      assert.deepEqual(await row(context.getPoolFn(), armed.runId), { status: 'cancelled', invalid_attempt_count: 0 });
      assert.deepEqual(await row(context.getPoolFn(), replacement.runId), { status: 'armed', invalid_attempt_count: 0 });
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM app_users WHERE username='recoveredadmin'")).rows[0].count, 0);
      assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
    });
  });

  test('expiry committed by a row holder is checked after the real wait rather than at transaction start', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_wait_expiry', async (context, scope) => {
      const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const service = createAdminRecoveryService({ hashPasswordFn: async password => { const hash = await hashPassword(password); ready.release(); await hold.promise; return hash; } });
      const armed = await service.armBootstrapAdminRecovery();
      const pending = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode))));
      await waitForFixtureReady({ ready: ready.promise, operation: pending, signal: scope.signal });
      const blocker = await context.getPoolFn().connect();
      try {
        await blocker.query('BEGIN'); await blocker.query('SELECT id FROM admin_recovery_runs WHERE id=$1 FOR UPDATE', [armed.runId]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        hold.release(); await waitBlocked(context, scope, pid, pending);
        await blocker.query("UPDATE admin_recovery_runs SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1", [armed.runId]);
        await blocker.query('COMMIT');
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      const outcome = await pending; assert.equal(outcome.ok, false); assert.equal(outcome.error.status, 401);
      assert.deepEqual(await row(context.getPoolFn(), armed.runId), { status: 'expired', invalid_attempt_count: 0 });
      assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
    });
  });

  test('concurrent wrong codes consume exactly the budget with one durable invalidation', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_attempts', async context => {
      const service = createAdminRecoveryService(); const armed = await service.armBootstrapAdminRecovery();
      const outcomes = await Promise.all(Array.from({ length: 7 }, () => settled(service.completeBootstrapAdminRecovery(form('HARM-WRONG-CODE-1234')))));
      assert.equal(outcomes.every(result => !result.ok), true); assert.equal(outcomes.filter(result => result.error.status === 429).length, 1);
      assert.deepEqual(await row(context.getPoolFn(), armed.runId), { status: 'invalidated', invalid_attempt_count: 5 });
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND event_type='bootstrap_admin_recovery_invalidated'", [armed.runId])).rows[0].count, 1);
      assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
    });
  });

  test('later maintenance acquisition waits for the recovery transaction and then blocks a new arm', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_maintenance', async (context, scope) => {
      const accounts = createAdminRecoveryAccountStore(); const maintenance = createMaintenanceLockService();
      const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const service = createAdminRecoveryService({ recoveryAccountStore: { upsertAdminAccount: async options => {
        const id = await accounts.upsertAdminAccount(options);
        ready.release((await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); await hold.promise; return id;
      } } });
      const armed = await service.armBootstrapAdminRecovery();
      const completing = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode))));
      const pid = await waitForFixtureReady({ ready: ready.promise, operation: completing, signal: scope.signal });
      const acquiring = scope.track(settled(maintenance.acquireMaintenanceLock({ lockType: 'restore', reason: 'owned recovery guard proof' })));
      scope.onRelease(async () => { const result = await acquiring; if (result.ok) await maintenance.releaseMaintenanceLock({ lockId: result.value.id }); });
      await waitBlocked(context, scope, pid, acquiring); hold.release();
      assert.equal((await completing).ok, true); assert.equal((await acquiring).ok, true);
      await assert.rejects(service.armBootstrapAdminRecovery(), { code: 'RECOVERY_LOCK_CONFLICT' });
    });
  });

  test('native upsert restores the existing account identity and login flags, revokes sessions and requires explicit later login', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_atomic_existing_account', async context => {
      const pool = context.getPoolFn(); const original = (await pool.query("UPDATE app_users SET role='requester', is_disabled=TRUE, must_change_password=TRUE, failed_login_count=4, locked_until=NOW()+INTERVAL '1 hour' WHERE username='admin' RETURNING id")).rows[0].id;
      const service = createAdminRecoveryService(); const armed = await service.armBootstrapAdminRecovery();
      assert.equal((await service.completeBootstrapAdminRecovery(form(armed.recoveryCode, 'ADMIN'))).requiresLogin, true);
      const user = (await pool.query("SELECT id, role, is_disabled, must_change_password, failed_login_count, locked_until, password_hash FROM app_users WHERE username='admin'")).rows[0];
      assert.equal(user.id, original); assert.equal(user.role, 'admin'); assert.equal(user.is_disabled, false); assert.equal(user.must_change_password, false);
      assert.equal(user.failed_login_count, 0); assert.equal(user.locked_until, null); assert.equal(await verifyPassword('RecoveredPass123!', user.password_hash), true);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM app_users')).rows[0].count, 1);
      assert.equal((await context.client.requestJson('/api/v1/auth/session')).payload.user, null);
      assert.equal((await context.client.requestJson('/api/v1/auth/login', { method: 'POST', json: { username: 'admin', password: 'RecoveredPass123!' } })).response.status, 200);
    });
  });
});
