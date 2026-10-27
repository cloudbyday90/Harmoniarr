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
import { createSessionIssuanceService } from '/app/server-dist/session-issuance-service.js';
import { createSessionReplayService, handleSessionReplay } from '/app/server-dist/session-replay-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { sessionFamilyLockKey } from '/app/server-dist/session-family-lock-store.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('session rotation serializes replay, owns atomic issuance and refuses stale authority', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], releases = new Set(), active = new Set();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl);
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-rotation-fixture' };
  let runtime, userId;
  const session = token => ({ refreshTokenId: token.refreshTokenId, appUserId: userId, tokenFamilyId: token.tokenFamilyId, refreshToken: token.refreshToken });
  const seed = () => issueSession({ userId, requestMetadata: metadata });
  const row = token => findRefreshTokenSession(pool, hashToken(token.refreshToken));
  const replay = async token => handleSessionReplay({ row: await row(token), requestMetadata: metadata });
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  async function state(token) {
    return (await observer.query(`SELECT
      (SELECT count(*)::int FROM refresh_tokens WHERE token_family_id=$1) AS tokens,
      (SELECT count(*)::int FROM refresh_tokens WHERE token_family_id=$1 AND NOT is_revoked) AS active,
      (SELECT count(*)::int FROM audit_events WHERE event_type='session_rotated' AND details->>'tokenFamilyId'=$1::text) AS rotations,
      (SELECT count(*)::int FROM audit_events WHERE event_type='refresh_token_reuse_detected' AND details->>'tokenFamilyId'=$1::text) AS replays`, [token.tokenFamilyId])).rows[0];
  }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const familyWaiting = async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%') AS waiting")).rows[0].waiting;
  function gate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      try { const result = await work(client, check); ready.resolve(); await release.promise; check(); return result; }
      catch (error) { ready.reject(error); throw error; }
    }) };
  }
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_rotation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='session_rotated' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_rotation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_rotation_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_rotation_audit ON audit_events; DROP FUNCTION public.fixture_rotation_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'rotation-admin', password: 'RotationNativeFixture123!' } })).response.status, 201);
    userId = (await pool.query("SELECT id FROM app_users WHERE username='rotation-admin'")).rows[0].id;
    const cookieBefore = http.getCookieHeader();
    for (const headers of [{}, { 'x-csrf-token': 'invalid' }]) {
      const denied = await http.requestJson('/api/v1/auth/refresh', { method: 'POST', csrf: false, headers });
      assert.equal(denied.response.status, 403); assert.equal(http.getCookieHeader(), cookieBefore);
    }
    assert.equal((await http.requestJson('/api/v1/auth/refresh', { method: 'POST' })).response.status, 200);
    assert.notEqual(http.getCookieHeader(), cookieBefore); results.push('http-csrf-refusal-and-successful-cookie-rotation');

    const ordinary = await seed(), issued = await rotateSession(session(ordinary), metadata);
    assert.deepEqual(await state(ordinary), { tokens: 2, active: 1, rotations: 1, replays: 0 });
    const parent = (await observer.query('SELECT is_revoked,revoked_reason,replaced_by_refresh_token_id FROM refresh_tokens WHERE id=$1', [ordinary.refreshTokenId])).rows[0];
    assert.deepEqual(parent, { is_revoked: true, revoked_reason: 'rotated', replaced_by_refresh_token_id: issued.refreshTokenId });
    assert.equal((await row(issued)).is_revoked, false); results.push('atomic-parent-child-link-audit-success');

    const duplicate = await seed();
    const competing = await Promise.allSettled([rotateSession(session(duplicate), metadata), rotateSession(session(duplicate), metadata)]);
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(competing.find(result => result.status === 'rejected').reason.status, 401);
    assert.deepEqual(await state(duplicate), { tokens: 2, active: 0, rotations: 1, replays: 1 }); results.push('same-parent-competing-redemptions-one-child-then-replay');

    for (const first of ['rotation', 'replay']) {
      const ancestor = await seed(), child = await rotateSession(session(ancestor), metadata), held = gate();
      let initial, contender;
      await withWorkerTaskCleanup(async () => {
        if (first === 'rotation') {
          initial = track(createSessionIssuanceService({ startTransactionFn: held.startTransactionFn }).rotateSession(session(child), metadata));
          await held.ready; contender = track(replay(ancestor));
        } else {
          initial = track(createSessionReplayService({ startTransactionFn: held.startTransactionFn })({ row: await row(ancestor), requestMetadata: metadata }));
          await held.ready; contender = track(rotateSession(session(child), metadata));
        }
        const outcomes = Promise.allSettled([initial, contender]); await until(familyWaiting); held.open();
        const completed = await outcomes; assert.equal(completed[0].status, 'fulfilled');
        if (first === 'replay') { assert.equal(completed[1].status, 'rejected'); assert.equal(completed[1].reason.status, 401); }
        else assert.equal(completed[1].status, 'fulfilled');
        assert.deepEqual(await state(ancestor), { tokens: first === 'rotation' ? 3 : 2, active: 0, rotations: first === 'rotation' ? 2 : 1, replays: 1 });
      }, async () => { held.open(); await Promise.allSettled([initial, contender].filter(Boolean)); });
      results.push(first + '-first-family-fence-no-escaped-child');
    }

    const auditFailure = await seed();
    await auditTrigger("RAISE EXCEPTION 'fixture required rotation audit failure';", async () => {
      await assert.rejects(rotateSession(session(auditFailure), metadata), error => error.status === 503 && error.cause.code === 'P0001');
      assert.deepEqual(await state(auditFailure), { tokens: 1, active: 1, rotations: 0, replays: 0 });
    });
    await rotateSession(session(auditFailure), metadata); results.push('required-audit-failure-rolls-back-child-parent-and-link');

    for (const boundary of ['account', 'family', 'parent']) {
      const locked = await seed(); await observer.query('BEGIN');
      if (boundary === 'account') await observer.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [userId]);
      if (boundary === 'family') await observer.query('SELECT pg_advisory_xact_lock($1::bigint)', [sessionFamilyLockKey(locked.tokenFamilyId)]);
      if (boundary === 'parent') await observer.query('SELECT id FROM refresh_tokens WHERE id=$1 FOR UPDATE', [locked.refreshTokenId]);
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(rotateSession(session(locked), metadata), error => error.status === 503 && error.cause.code === '55P03');
      }, () => observer.query('ROLLBACK'));
      assert.deepEqual(await state(locked), { tokens: 1, active: 1, rotations: 0, replays: 0 });
      await rotateSession(session(locked), metadata); results.push(boundary + '-lock-timeout-clean-rollback-and-retry');
    }

    for (const changed of ['disabled', 'forced', 'expired', 'password', 'hash', 'family']) {
      const stale = await seed(), accepted = session(stale);
      if (changed === 'disabled') await observer.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [userId]);
      if (changed === 'forced') await observer.query('UPDATE app_users SET must_change_password=TRUE WHERE id=$1', [userId]);
      if (changed === 'expired') await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [stale.refreshTokenId]);
      if (changed === 'password') await observer.query("UPDATE refresh_tokens SET issued_at='2026-01-01 00:00:00.000100+00' WHERE id=$1;", [stale.refreshTokenId]);
      if (changed === 'password') await observer.query("UPDATE app_users SET password_changed_at='2026-01-01 00:00:00.000200+00' WHERE id=$1", [userId]);
      if (changed === 'hash') accepted.refreshToken = 'wrong-token';
      if (changed === 'family') accepted.tokenFamilyId = '00000000-0000-0000-0000-000000000000';
      try { await assert.rejects(rotateSession(accepted, metadata), { status: changed === 'forced' ? 403 : 401 }); assert.equal((await state(stale)).tokens, 1); }
      finally { await observer.query('UPDATE app_users SET is_disabled=FALSE,must_change_password=FALSE,password_changed_at=NULL WHERE id=$1', [userId]); }
    }
    results.push('current-account-parent-hash-family-expiry-and-microsecond-password-epoch');

    const freshRole = await seed(); await observer.query('BEGIN'); await observer.query("UPDATE app_users SET role='requester' WHERE id=$1", [userId]);
    const roleResult = track(rotateSession(session(freshRole), metadata));
    await withWorkerTaskCleanup(async () => {
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%WHERE id = ANY%') AS waiting")).rows[0].waiting);
    }, () => observer.query('COMMIT'));
    assert.equal((await roleResult).user.role, 'requester'); await observer.query("UPDATE app_users SET role='admin' WHERE id=$1", [userId]);
    results.push('fresh-owner-snapshot-after-account-lock-wait');

    const finalExpiry = await seed();
    await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [finalExpiry.refreshTokenId]);
    await auditTrigger('PERFORM pg_sleep(1.5);', async () => {
      await assert.rejects(rotateSession(session(finalExpiry), metadata), { status: 503 });
      assert.equal((await state(finalExpiry)).tokens, 1);
    }); results.push('expiry-during-required-audit-rolls-back-publication');

    const uncertain = await seed(); let commits = 0;
    const lost = createSessionIssuanceService({ startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost commit acknowledgement'); } return value; };
      return client;
    } }) }) });
    await assert.rejects(lost.rotateSession(session(uncertain), metadata), { status: 503 });
    assert.equal(commits, 1); assert.deepEqual(await state(uncertain), { tokens: 2, active: 1, rotations: 1, replays: 0 });
    await assert.rejects(rotateSession(session(uncertain), metadata), { status: 401 });
    assert.deepEqual(await state(uncertain), { tokens: 2, active: 0, rotations: 1, replays: 1 });
    results.push('real-commit-controlled-ack-loss-no-reissue-and-explicit-replay');

    const timed = await seed(); let task, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const service = createSessionIssuanceService({ startTransactionFn: work => {
        task = startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { timeoutMs: 1_000 }); return task;
      } });
      const refused = assert.rejects(service.rotateSession(session(timed), metadata), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(timed), { tokens: 1, active: 1, rotations: 0, replays: 0 });
    }); results.push('deadline-native-retirement-no-child-or-parent-change');
    await assert.rejects(issueSession({ userId, tokenFamilyId: ordinary.tokenFamilyId, requestMetadata: metadata }), TypeError);
    results.push('root-issuance-cannot-graft-into-revoked-family');
    assert.equal((await pool.query("SELECT current_setting('statement_timeout') AS timeout")).rows[0].timeout, '0');
  }, async () => {
    for (const release of releases) release.resolve();
    await observer.query('ROLLBACK').catch(() => {}); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, noEscapedChild: true, requiredAuditAtomic: true, commitLossControlled: true, actualBackendRetirement: true }));
});
