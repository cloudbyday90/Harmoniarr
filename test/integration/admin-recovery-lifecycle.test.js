/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { recordAuditEvent } from '../../src/server/audit.js';
import { createAdminRecoveryService, hashRecoveryCode, verifyRecoveryCode } from '../../src/server/recovery/admin-recovery-service.js';
import { createAdminRecoveryStore } from '../../src/server/recovery/admin-recovery-store.js';
import { createAdminRecoveryAccountStore } from '../../src/server/recovery/admin-recovery-account-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const indexName = 'admin_recovery_runs_one_armed_idx';
const migrationPath = new URL('../../src/server/migrations/20261021_223053_admin_recovery_one_armed_run.sql', import.meta.url);
const settled = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
const form = code => ({ recoveryCode: code, username: 'recoveredadmin', password: 'RecoveredPass123!', confirmPassword: 'RecoveredPass123!' });
async function projection(pool) {
  const runs = (await pool.query('SELECT to_jsonb(r) AS row FROM admin_recovery_runs r ORDER BY id')).rows;
  const audits = (await pool.query("SELECT to_jsonb(a) AS row FROM audit_events a WHERE entity_type='admin_recovery_run' ORDER BY id")).rows;
  return createHash('sha256').update(JSON.stringify({ runs, audits })).digest('hex');
}
async function scenario(t, name, work) {
  await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, scope => work(context, scope)), { scenarioName: name });
}
async function waitBlocked(context, scope, holderPid, operation, queryPrefix) {
  await withFixturePostgresObserver({ connectionConfig: context.databaseConfig, signal: scope.signal }, async observer => {
    await waitForFixturePostgresBlock({ queryable: observer, holderPid, operation, signal: scope.signal });
    const waiters = await observer.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
      AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE $2`, [holderPid, `${queryPrefix}%`]);
    assert.equal(waiters.rowCount, 1);
  });
}

suite('Atomic recovery operator lifecycle with native PostgreSQL', () => {
  before(async () => { runtime = await createIntegrationAppRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('concurrent empty-state arms wait on lifecycle ownership; exactly one publishes material and an armed audit', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_empty_overlap', async (context, scope) => {
      const native = createAdminRecoveryStore(); const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => hold.release()); let inserted = false;
      const service = createAdminRecoveryService({ adminRecoveryStore: { ...native, insertRecoveryRun: async options => {
        const run = await native.insertRecoveryRun(options);
        ready.release((await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); inserted = true; await hold.promise; return run;
      } } });
      const first = scope.track(settled(service.armBootstrapAdminRecovery()));
      const pid = await waitForFixtureReady({ ready: ready.promise, operation: first, signal: scope.signal });
      const second = scope.track(settled(createAdminRecoveryService().armBootstrapAdminRecovery()));
      await waitBlocked(context, scope, pid, second, 'SELECT pg_advisory_xact_lock');
      assert.equal(inserted, true); hold.release(); const a = await first; const b = await second;
      assert.equal(a.ok, true); assert.equal(b.ok, false); assert.equal(b.error.code, 'RECOVERY_ALREADY_ARMED');
      const runs = (await context.getPoolFn().query('SELECT status, recovery_code_hash FROM admin_recovery_runs')).rows;
      assert.equal(runs.length, 1); assert.equal(runs[0].status, 'armed'); assert.equal(verifyRecoveryCode(a.value.recoveryCode, runs[0].recovery_code_hash), true);
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='bootstrap_admin_recovery_armed'")).rows[0].count, 1);
    });
  });

  test('queued force replacement has one final armed run and derives arm/expiry time after the wait', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_force_overlap', async (context, scope) => {
      const native = createAdminRecoveryStore(); const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const firstService = createAdminRecoveryService({ adminRecoveryStore: { ...native, insertRecoveryRun: async options => {
        const run = await native.insertRecoveryRun(options); ready.release((await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); await hold.promise; return run;
      } } });
      let acquiredAt;
      const secondService = createAdminRecoveryService({ adminRecoveryStore: { ...native,
        lockOperatorLifecycle: async options => { await native.lockOperatorLifecycle(options); acquiredAt = (await options.queryable.query('SELECT clock_timestamp()::text AS now')).rows[0].now; },
        insertRecoveryRun: async options => { const run = await native.insertRecoveryRun(options);
          const timing = (await options.queryable.query('SELECT armed_at >= $2::timestamptz AS fresh, expires_at-armed_at <= INTERVAL \'5 minutes 1 second\' AS bounded FROM admin_recovery_runs WHERE id=$1', [run.id, acquiredAt])).rows[0];
          assert.deepEqual(timing, { fresh: true, bounded: true }); return run; },
      } });
      const first = scope.track(settled(firstService.armBootstrapAdminRecovery()));
      const pid = await waitForFixtureReady({ ready: ready.promise, operation: first, signal: scope.signal });
      const second = scope.track(settled(secondService.armBootstrapAdminRecovery({ force: true, ttlMinutes: 5 })));
      await waitBlocked(context, scope, pid, second, 'SELECT pg_advisory_xact_lock'); hold.release();
      const a = await first; const b = await second; assert.equal(a.ok, true); assert.equal(b.ok, true); assert.equal(b.value.replacedExistingRun, true);
      const runs = (await context.getPoolFn().query('SELECT id, status, recovery_code_hash FROM admin_recovery_runs')).rows;
      assert.equal(runs.filter(run => run.status === 'armed').length, 1); assert.equal(runs.find(run => run.id === a.value.runId).status, 'cancelled');
      const current = runs.find(run => run.id === b.value.runId); assert.equal(verifyRecoveryCode(b.value.recoveryCode, current.recovery_code_hash), true);
      assert.equal(verifyRecoveryCode(a.value.recoveryCode, current.recovery_code_hash), false);
    });
  });

  test('blocked force-rearm preserves valid material and forced disarming remains available under the hold', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_maintenance', async context => {
      const service = createAdminRecoveryService(); const armed = await service.armBootstrapAdminRecovery();
      await createMaintenanceLockService().acquireMaintenanceLock({ lockType: 'restore', reason: 'owned operator refusal fixture' });
      const prior = await projection(context.getPoolFn()); await assert.rejects(service.armBootstrapAdminRecovery({ force: true }), { code: 'RECOVERY_LOCK_CONFLICT' });
      assert.equal(await projection(context.getPoolFn()), prior);
      const result = await service.cancelBootstrapAdminRecovery({ force: true }); assert.equal(result.runId, armed.runId); assert.equal(result.status, 'cancelled');
    });
  });

  test('native replacement and cancellation faults roll state/audits back and preserve Error/null', { timeout: config.scenarioTimeoutMs }, async t => {
    for (const phase of ['cancel-write', 'cancel-audit', 'insert', 'arm-audit', 'disarm-audit', 'initial-audit']) {
      await scenario(t, `recovery_lifecycle_rollback_${phase.replaceAll('-', '_')}`, async context => {
        const native = createAdminRecoveryStore(); const failure = phase === 'insert' || phase === 'disarm-audit' ? null : new Error('owned lifecycle failure');
        let enabled = false;
        const service = createAdminRecoveryService({ adminRecoveryStore: { ...native,
          cancelRecoveryRun: async options => { const run = await native.cancelRecoveryRun(options); if (enabled && phase === 'cancel-write') throw failure; return run; },
          insertRecoveryRun: async options => { const run = await native.insertRecoveryRun(options); if (enabled && phase === 'insert') throw failure; return run; },
        }, recordAuditEventFn: async (event, queryable) => { await recordAuditEvent(event, queryable);
          if (enabled && ((['cancel-audit', 'disarm-audit'].includes(phase) && event.eventType === 'bootstrap_admin_recovery_cancelled')
            || (['arm-audit', 'initial-audit'].includes(phase) && event.eventType === 'bootstrap_admin_recovery_armed'))) throw failure;
        } });
        if (phase !== 'initial-audit') await service.armBootstrapAdminRecovery();
        const prior = await projection(context.getPoolFn()); enabled = true;
        const outcome = await settled(phase === 'disarm-audit' ? service.cancelBootstrapAdminRecovery({ force: true }) : service.armBootstrapAdminRecovery({ force: true }));
        assert.equal(outcome.ok, false); assert.equal(outcome.error, failure); assert.equal(await projection(context.getPoolFn()), prior);
        enabled = false;
        if (phase === 'initial-audit') assert.equal((await service.armBootstrapAdminRecovery()).status, 'armed');
        else assert.equal((await service.cancelBootstrapAdminRecovery({ force: true })).status, 'cancelled');
      });
    }
  });

  test('completion winning a real row wait makes cancellation a truthful no-active-run refusal', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_completion_first', async (context, scope) => {
      const accounts = createAdminRecoveryAccountStore(); const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const service = createAdminRecoveryService({ recoveryAccountStore: { upsertAdminAccount: async options => {
        const id = await accounts.upsertAdminAccount(options); ready.release((await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); await hold.promise; return id;
      } } });
      const armed = await service.armBootstrapAdminRecovery(); const completion = scope.track(settled(service.completeBootstrapAdminRecovery(form(armed.recoveryCode))));
      const pid = await waitForFixtureReady({ ready: ready.promise, operation: completion, signal: scope.signal });
      const cancelling = scope.track(settled(createAdminRecoveryService().cancelBootstrapAdminRecovery({ force: true })));
      await waitBlocked(context, scope, pid, cancelling, 'SELECT id FROM admin_recovery_runs'); hold.release();
      assert.equal((await completion).ok, true); assert.equal((await cancelling).error.code, 'RECOVERY_NOT_ARMED');
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='bootstrap_admin_recovery_cancelled'")).rows[0].count, 0);
    });
  });

  test('cancellation winning its transaction prevents a pending completion from creating an account', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_cancel_first', async (context, scope) => {
      const native = createAdminRecoveryStore(); const ready = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate(); scope.onRelease(() => hold.release());
      const service = createAdminRecoveryService({ adminRecoveryStore: { ...native, cancelRecoveryRun: async options => {
        const run = await native.cancelRecoveryRun(options); ready.release((await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); await hold.promise; return run;
      } } });
      const armed = await service.armBootstrapAdminRecovery(); const cancelling = scope.track(settled(service.cancelBootstrapAdminRecovery({ force: true })));
      const pid = await waitForFixtureReady({ ready: ready.promise, operation: cancelling, signal: scope.signal });
      const completion = scope.track(settled(createAdminRecoveryService().completeBootstrapAdminRecovery(form(armed.recoveryCode))));
      await waitBlocked(context, scope, pid, completion, '\n        INSERT INTO maintenance_locks'); hold.release();
      assert.equal((await cancelling).ok, true); assert.equal((await completion).error.status, 401);
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM app_users WHERE username='recoveredadmin'")).rows[0].count, 0);
    });
  });

  test('cancel checks expiry after a run-row wait and commits expiry without a cancellation audit', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_expiry_wait', async (context, scope) => {
      const service = createAdminRecoveryService(); const armed = await service.armBootstrapAdminRecovery(); const blocker = await context.getPoolFn().connect();
      let cancelling;
      try {
        await blocker.query('BEGIN'); await blocker.query('SELECT id FROM admin_recovery_runs WHERE id=$1 FOR UPDATE', [armed.runId]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        cancelling = scope.track(settled(service.cancelBootstrapAdminRecovery({ force: true })));
        await waitBlocked(context, scope, pid, cancelling, 'SELECT id FROM admin_recovery_runs');
        await blocker.query("UPDATE admin_recovery_runs SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1", [armed.runId]); await blocker.query('COMMIT');
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      assert.equal((await cancelling).error.code, 'RECOVERY_NOT_ARMED');
      assert.equal((await context.getPoolFn().query('SELECT status FROM admin_recovery_runs WHERE id=$1', [armed.runId])).rows[0].status, 'expired');
      assert.equal((await context.getPoolFn().query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='bootstrap_admin_recovery_cancelled'")).rows[0].count, 0);
    });
  });

  test('database uniqueness refuses a bypass writer while retaining terminal history; ambiguous migration refuses without changing runs', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_lifecycle_index', async context => {
      const service = createAdminRecoveryService(); const native = createAdminRecoveryStore(); const armed = await service.armBootstrapAdminRecovery();
      const input = { recoveryCodeHash: hashRecoveryCode('fixture-only'), expiresAt: new Date(Date.now() + 300_000) };
      await assert.rejects(native.insertRecoveryRun(input), { code: '23505', constraint: indexName });
      await service.cancelBootstrapAdminRecovery({ force: true }); await native.insertRecoveryRun(input);
      assert.equal((await context.getPoolFn().query('SELECT count(*)::int AS count FROM admin_recovery_runs')).rows[0].count, 2);
      const index = (await context.getPoolFn().query('SELECT indisunique, indisvalid, pg_get_expr(indpred, indrelid) AS predicate FROM pg_index WHERE indexrelid=$1::regclass', [indexName])).rows[0];
      assert.equal(index.indisunique, true); assert.equal(index.indisvalid, true); assert.equal(index.predicate, "(status = 'armed'::text)");
      await context.getPoolFn().query(`DROP INDEX ${indexName}`); await native.insertRecoveryRun(input);
      const prior = await projection(context.getPoolFn()); const client = await context.getPoolFn().connect();
      try {
        await assert.rejects(client.query(await readFile(migrationPath, 'utf8')), error => error.code === '23505' && error.message.startsWith('Multiple armed recovery runs require operator review'));
      } finally { await client.query('ROLLBACK'); client.release(); }
      assert.equal(await projection(context.getPoolFn()), prior);
      assert.equal((await context.getPoolFn().query('SELECT status FROM admin_recovery_runs WHERE id=$1', [armed.runId])).rows[0].status, 'cancelled');
    });
  });
});
