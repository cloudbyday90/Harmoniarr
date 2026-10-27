/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { issueSession, rotateSession } from '/app/server-dist/auth.js';
import { findRefreshTokenSession } from '/app/server-dist/auth-session-store.js';
import { hashToken } from '/app/server-dist/security.js';
import { createSessionReplayService, handleSessionReplay } from '/app/server-dist/session-replay-service.js';
import { startSessionReplayTransaction } from '/app/server-dist/session-replay-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

test('replay security writes are atomic, bounded, idempotent and owned beyond HTTP disconnection', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [];
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl);
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-replay-fixture' };
  let runtime, userId;
  const held = [];
  async function seed() {
    const parent = await issueSession({ userId, requestMetadata: metadata });
    const child = await rotateSession({ refreshTokenId: parent.refreshTokenId, appUserId: userId, tokenFamilyId: parent.tokenFamilyId, refreshToken: parent.refreshToken }, metadata);
    return { parent, child, row: await findRefreshTokenSession(pool, hashToken(parent.refreshToken)) };
  }
  const replay = data => handleSessionReplay({ row: data.row, requestMetadata: metadata });
  async function state(data) {
    return (await observer.query(`SELECT
      (SELECT count(*)::int FROM public.refresh_tokens WHERE token_family_id=$1 AND is_revoked=FALSE) AS active,
      (SELECT count(*)::int FROM public.audit_events WHERE event_type='refresh_token_reuse_detected' AND details->>'tokenFamilyId'=$1::text) AS audits`, [data.row.token_family_id])).rows[0];
  }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) {
      t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle');
      await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); });
    }
  }
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_replay_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='refresh_token_reuse_detected' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_replay_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_replay_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_replay_audit ON public.audit_events; DROP FUNCTION public.fixture_replay_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'replay-admin', password: 'ReplayNativeFixture123!' } })).response.status, 201);
    userId = (await pool.query("SELECT id FROM app_users WHERE username='replay-admin'")).rows[0].id;
    const data = await seed();
    assert.equal(await replay(data), 1); assert.deepEqual(await state(data), { active: 0, audits: 1 });
    assert.equal(await replay(data), 0); assert.deepEqual(await state(data), { active: 0, audits: 1 });
    const event = (await observer.query("SELECT details FROM audit_events WHERE entity_id=$1 AND event_type='refresh_token_reuse_detected'", [data.row.refresh_token_id])).rows[0];
    assert.deepEqual(event.details, { tokenFamilyId: data.row.token_family_id, previousRevokedReason: 'rotated' });
    assert.doesNotMatch(JSON.stringify(event), new RegExp(data.parent.refreshToken, 'u'));
    results.push('atomic-success-and-repeat-noop');

    const concurrent = await seed();
    assert.equal((await Promise.all(Array.from({ length: 12 }, () => replay(concurrent)))).reduce((a, b) => a + b), 1);
    assert.deepEqual(await state(concurrent), { active: 0, audits: 1 }); results.push('twelve-concurrent-replays-one-audit');

    const failedAudit = await seed();
    await auditTrigger("RAISE EXCEPTION 'fixture required audit failure';", async () => {
      await assert.rejects(replay(failedAudit), error => error.status === 503 && error.cause.code === 'P0001');
      assert.deepEqual(await state(failedAudit), { active: 1, audits: 0 });
    });
    assert.equal(await replay(failedAudit), 1); results.push('required-audit-failure-atomic-rollback-and-retry');

    for (const boundary of ['family', 'audit']) {
      const locked = await seed();
      await observer.query('BEGIN');
      if (boundary === 'family') await observer.query('SELECT id FROM refresh_tokens WHERE id=$1 FOR UPDATE', [locked.child.refreshTokenId]);
      else await observer.query('LOCK TABLE public.audit_events IN ACCESS EXCLUSIVE MODE');
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(replay(locked), error => error.status === 503 && error.cause.code === '55P03');
      }, () => observer.query('ROLLBACK'));
      assert.deepEqual(await state(locked), { active: 1, audits: 0 });
      assert.equal(await replay(locked), 1); results.push(boundary + '-lock-timeout-rollback-and-retry');
    }
    const settings = (await pool.query("SELECT current_setting('statement_timeout') AS statement,current_setting('transaction_read_only') AS readonly")).rows[0];
    assert.deepEqual(settings, { statement: '0', readonly: 'off' });

    for (const change of ['expired', 'disabled', 'unlinked', 'identity']) {
      const stale = await seed();
      if (change === 'expired') await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [stale.parent.refreshTokenId]);
      if (change === 'disabled') await observer.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [userId]);
      if (change === 'unlinked') await observer.query('UPDATE refresh_tokens SET replaced_by_refresh_token_id=NULL WHERE id=$1', [stale.parent.refreshTokenId]);
      if (change === 'identity') stale.row.app_user_id = '00000000-0000-0000-0000-000000000000';
      try { assert.equal(await replay(stale), 0); assert.deepEqual(await state(stale), { active: 1, audits: 0 }); }
      finally { if (change === 'disabled') await observer.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [userId]); }
    }
    results.push('current-token-owner-and-identity-refusal');

    const expired = await seed(); let owned, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const slowStatement = await seed();
      await assert.rejects(replay(slowStatement), error => error.status === 503 && error.cause.code === '57014');
      assert.deepEqual(await state(slowStatement), { active: 1, audits: 0 });
      results.push('native-statement-timeout-atomic-rollback');
      const service = createSessionReplayService({ startTransactionFn: work => {
        owned = startSessionReplayTransaction(async (client, check) => {
          pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          return work(client, check);
        }, { timeoutMs: 1_000 }); return owned;
      } });
      const refused = assert.rejects(service({ row: expired.row, requestMetadata: metadata }), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await owned.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(expired), { active: 1, audits: 0 });
    });
    assert.equal(await replay(expired), 1); results.push('deadline-native-backend-retirement-and-rollback');

    // Controlled acknowledgement loss after a real server COMMIT. No network-loss claim.
    const uncertain = await seed(); let commits = 0;
    const lost = createSessionReplayService({ startTransactionFn: work => startSessionReplayTransaction(work, { getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const result = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost commit acknowledgement'); } return result; };
      return client;
    } }) }) });
    await assert.rejects(lost({ row: uncertain.row, requestMetadata: metadata }), { status: 503 });
    assert.equal(commits, 1); assert.deepEqual(await state(uncertain), { active: 0, audits: 1 });
    assert.equal(await replay(uncertain), 0); assert.deepEqual(await state(uncertain), { active: 0, audits: 1 });
    results.push('real-commit-controlled-acknowledgement-loss-no-duplicate');

    const overload = await seed();
    for (let i = 0; i < 4; i++) held.push(await pool.connect());
    await withWorkerTaskCleanup(async () => { await assert.rejects(replay(overload), { status: 503 }); }, async () => { while (held.length) held.pop().release(); });
    assert.deepEqual(await state(overload), { active: 1, audits: 0 }); assert.equal(await replay(overload), 1);
    results.push('exhausted-pool-no-writes-and-explicit-retry');

    const disconnected = await seed(), controller = new AbortController();
    await observer.query('BEGIN'); await observer.query('LOCK TABLE public.audit_events IN ACCESS EXCLUSIVE MODE');
    const pending = assert.rejects(fetch(baseUrl + '/api/v1/auth/sessions', { headers: { cookie: 'harmoniarr_refresh=' + disconnected.parent.refreshToken }, signal: controller.signal }), { name: 'AbortError' });
    await withWorkerTaskCleanup(async () => {
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%INSERT INTO audit_events%') AS waiting")).rows[0].waiting);
      controller.abort(); await pending;
    }, async () => { controller.abort(); await pending; await observer.query('ROLLBACK'); });
    await until(async () => (await state(disconnected)).audits === 1);
    assert.deepEqual(await state(disconnected), { active: 0, audits: 1 }); results.push('http-disconnect-security-action-remains-owned');

    const route = await seed();
    const response = await fetch(baseUrl + '/api/v1/auth/sessions', { headers: { cookie: 'harmoniarr_refresh=' + route.parent.refreshToken } });
    assert.equal(response.status, 401); await response.json(); assert.deepEqual(await state(route), { active: 0, audits: 1 });
    const childResponse = await fetch(baseUrl + '/api/v1/auth/sessions', { headers: { cookie: 'harmoniarr_refresh=' + route.child.refreshToken } });
    assert.equal(childResponse.status, 401); await childResponse.json(); results.push('real-http-replay-and-child-authority-refused');

    for (const address of ['invalid-address', 'fe80::1%eth0']) {
      const malformed = await seed();
      const invalidMetadata = await fetch(baseUrl + '/api/v1/auth/sessions', { headers: {
        cookie: 'harmoniarr_refresh=' + malformed.parent.refreshToken, 'x-forwarded-for': address,
      } });
      assert.equal(invalidMetadata.status, 401); await invalidMetadata.json();
      assert.deepEqual(await state(malformed), { active: 0, audits: 1 });
      assert.equal((await observer.query("SELECT ip_address FROM audit_events WHERE entity_id=$1 AND event_type='refresh_token_reuse_detected'", [malformed.parent.refreshTokenId])).rows[0].ip_address, null);
    }
    results.push('malformed-forwarded-ip-cannot-veto-revocation');
  }, async () => {
    while (held.length) held.pop().release(true);
    await withWorkerTaskCleanup(async () => { try { await observer.query('ROLLBACK'); } finally { await observer.end(); } }, async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, atomicAudit: true, noAutomaticCommitRetry: true, actualBackendRetirement: true }));
});
