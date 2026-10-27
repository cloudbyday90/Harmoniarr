/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { loginLinkedUser } from '/app/server-dist/auth.js';
import { hashToken } from '/app/server-dist/security.js';
import { findRefreshTokenSession } from '/app/server-dist/auth-session-store.js';
import { createLinkedLoginService, readLinkedPlexLoginUser } from '/app/server-dist/linked-login-service.js';
import { createPlexDirectSignInService } from '/app/server-dist/integrations/plex/plex-direct-sign-in-service.js';
import { createPlexHttpClient } from '/app/server-dist/integrations/plex/plex-http-client.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('linked login fences current provider identity and atomically owns bookkeeping, issuance and audit', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500'; process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], releases = new Set(), active = new Set();
  const baseUrl = 'http://127.0.0.1:3000', subject = 'fixture-plex-uuid', plexId = '987654321';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-linked-login' };
  let runtime, userId, numericUserId, callbackService, callbackFailure, transportMode = 'normal', networkCalls = 0;
  const proof = () => ({ userId, provider: 'plex', subject, requestMetadata: metadata });
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const transport = createPlexHttpClient({ fetchFn: async (url, options) => {
    assert.equal(pool.idleCount, pool.totalCount, 'Provider network calls must not hold a checkout'); networkCalls++;
    const parsed = new URL(url); assert.equal(parsed.origin, 'https://plex.tv');
    assert.ok(options.headers['X-Plex-Client-Identifier']);
    if (parsed.pathname === '/api/v2/pins') return Response.json({ id: 123, code: 'fixture-pin' });
    if (parsed.pathname === '/api/v2/pins/123') return Response.json({ authToken: 'public-fixture-provider-token' });
    assert.equal(parsed.pathname, '/api/v2/user'); assert.equal(options.headers['X-Plex-Token'], 'public-fixture-provider-token');
    if (transportMode === 'unauthorized') return Response.json({ message: 'fixture provider refusal' }, { status: 401 });
    if (transportMode === 'empty') return Response.json({});
    return Response.json({ id: plexId, uuid: subject, username: 'provider-name', email: 'provider@example.test', restricted: transportMode === 'restricted' });
  } });
  const callbacks = options => createPlexDirectSignInService({ plexHttpClient: transport, loadSettingsFn: async () => ({ system: { baseUrl } }), ...options });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createPlexDirectSignInService: () => ({ startSignIn: input => callbackService.startSignIn(input),
      completeSignIn: input => track(callbackService.completeSignIn(input).catch(error => { callbackFailure = error; throw error; })) }) });
  const state = async () => (await observer.query(`SELECT failed_login_count,locked_until::text,last_login_at::text,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$1 AND event_type='plex_sign_in_succeeded') AS audits
    FROM app_users WHERE id=$1`, [userId])).rows[0];
  async function reset() {
    transportMode = 'normal'; callbackService = callbacks();
    await observer.query(`UPDATE app_users SET auth_provider='plex',auth_subject=$2,is_disabled=FALSE,role='admin',must_change_password=FALSE,
      failed_login_count=3,locked_until=clock_timestamp()+interval '15 minutes',last_login_at='2026-01-01' WHERE id=$1`, [userId, subject]);
  }
  async function pending(service = callbackService) {
    const started = await service.startSignIn({ redirectTo: '/app/activity', requestMetadata: { origin: baseUrl } });
    return new URL(new URLSearchParams(started.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
  }
  function candidateGate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, service: callbacks({ findLinkedUserFn: async input => {
      const candidate = await readLinkedPlexLoginUser(input); ready.resolve(); await release.promise; return candidate;
    } }) };
  }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const waiting = async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%WHERE id = ANY%') AS waiting")).rows[0].waiting;
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_linked_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='plex_sign_in_succeeded' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_linked_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_linked_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_linked_audit ON audit_events; DROP FUNCTION public.fixture_linked_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    const bootstrap = await fetch(baseUrl + '/api/v1/bootstrap/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'linked-admin', password: 'LinkedNativeFixture123!' }) });
    assert.equal(bootstrap.status, 201); await bootstrap.json();
    userId = (await observer.query("SELECT id FROM app_users WHERE username='linked-admin'")).rows[0].id;
    numericUserId = (await observer.query(`INSERT INTO app_users(username,password_hash,role,auth_provider,auth_subject)
      SELECT 'numeric-linked',password_hash,'requester','plex',$2 FROM app_users WHERE id=$1 RETURNING id`, [userId, plexId])).rows[0].id;
    await reset();
    const selected = await readLinkedPlexLoginUser({ plexUuid: subject, plexId }); assert.deepEqual(selected, { id: userId, auth_provider: 'plex', auth_subject: subject });
    assert.equal((await readLinkedPlexLoginUser({ plexId })).id, numericUserId);
    assert.equal(await readLinkedPlexLoginUser({ plexUuid: 'missing', plexId: 'missing-id' }), null);
    results.push('real-minimal-lookup-uuid-priority-numeric-fallback-and-missing');

    const before = await state(), result = await callbackService.completeSignIn({ state: await pending(), requestMetadata: metadata }), after = await state();
    assert.equal(after.failed_login_count, 0); assert.equal(after.locked_until, null); assert.equal(after.tokens, before.tokens + 1); assert.equal(after.audits, before.audits + 1);
    assert.equal(result.user.last_login_at.getTime(), result.issuedSession.user.lastLoginAt.getTime());
    assert.equal((await findRefreshTokenSession(pool, hashToken(result.issuedSession.refreshToken))).app_user_id, userId);
    assert.doesNotMatch(JSON.stringify(result.user), /password_hash|auth_subject|provider-token|credential_epoch/u);
    const audit = (await observer.query("SELECT details,user_agent FROM audit_events WHERE actor_user_id=$1 AND event_type='plex_sign_in_succeeded' ORDER BY occurred_at DESC LIMIT 1", [userId])).rows[0];
    assert.deepEqual(audit, { details: null, user_agent: metadata.userAgent }); results.push('controlled-provider-real-callback-atomic-bookkeeping-session-audit');

    await reset(); const holders = []; const readBefore = await state();
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 4; index++) holders.push(await pool.connect());
      await assert.rejects(readLinkedPlexLoginUser({ plexUuid: subject, plexId }), { status: 503, code: 'auth_lookup_unavailable' });
    }, () => { for (const client of holders) client.release(); });
    assert.deepEqual(await state(), readBefore); results.push('bounded-candidate-read-pool-exhaustion-has-no-login-writes');

    for (const kind of ['subject', 'provider', 'unlinked', 'disabled', 'relinked']) {
      await reset(); const gate = candidateGate(), stateKey = await pending(gate.service), pendingResult = track(gate.service.completeSignIn({ state: stateKey, requestMetadata: metadata })); await gate.ready;
      const changes = { subject: ["auth_subject='changed-subject'"], provider: ["auth_provider='local'"], unlinked: ['auth_subject=NULL'], disabled: ['is_disabled=TRUE'], relinked: ["auth_subject='moved-subject'"] }[kind];
      await observer.query(`UPDATE app_users SET ${changes[0]} WHERE id=$1`, [userId]);
      if (kind === 'relinked') await observer.query('UPDATE app_users SET auth_subject=$2 WHERE id=$1', [numericUserId, subject]);
      const stable = await state(); gate.open(); await assert.rejects(pendingResult, { status: 403 }); assert.deepEqual(await state(), stable);
      if (kind === 'relinked') await observer.query('UPDATE app_users SET auth_subject=$2 WHERE id=$1', [numericUserId, plexId]);
      results.push('verified-callback-refuses-current-' + kind);
    }
    await reset(); const missingBefore = await state();
    await assert.rejects(loginLinkedUser({ ...proof(), userId: randomUUID() }), { status: 403 }); assert.deepEqual(await state(), missingBefore);
    results.push('missing-current-account-refuses-without-writes');

    for (const kind of ['subject', 'role']) {
      await reset(); await observer.query('BEGIN');
      await observer.query(`UPDATE app_users SET ${kind === 'subject' ? "auth_subject='writer-changed'" : "role='requester',must_change_password=TRUE"} WHERE id=$1`, [userId]);
      const stable = await state(), pendingResult = track(loginLinkedUser(proof()));
      await withWorkerTaskCleanup(() => until(waiting), () => observer.query('COMMIT'));
      if (kind === 'subject') { await assert.rejects(pendingResult, { status: 403 }); assert.deepEqual(await state(), stable); }
      else { const current = await pendingResult; assert.equal(current.user.role, 'requester'); assert.equal(current.issuedSession.user.mustChangePassword, true); }
      results.push('fresh-' + kind + '-after-actual-account-writer-wait');
    }
    await reset(); const concurrentBefore = await state();
    const concurrent = await Promise.all([track(loginLinkedUser(proof())), track(loginLinkedUser(proof()))]);
    assert.notEqual(concurrent[0].issuedSession.tokenFamilyId, concurrent[1].issuedSession.tokenFamilyId);
    assert.equal((await state()).tokens, concurrentBefore.tokens + 2); assert.equal((await state()).audits, concurrentBefore.audits + 2);
    results.push('independent-logins-serialize-without-lost-bookkeeping');

    await reset(); const lockedBefore = await state(); await observer.query('BEGIN'); await observer.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [userId]);
    await withWorkerTaskCleanup(async () => { await assert.rejects(loginLinkedUser(proof()), { status: 503 }); }, () => observer.query('ROLLBACK'));
    assert.deepEqual(await state(), lockedBefore); results.push('account-lock-timeout-rolls-back-without-publication');

    await reset(); const suppressedBefore = await state();
    await observer.query(`CREATE FUNCTION public.fixture_linked_bookkeeping() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN RETURN NULL; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_linked_bookkeeping BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION public.fixture_linked_bookkeeping()`);
    await withWorkerTaskCleanup(async () => {
      await assert.rejects(loginLinkedUser(proof()), { status: 503 }); assert.deepEqual(await state(), suppressedBefore);
    }, () => observer.query('DROP TRIGGER fixture_linked_bookkeeping ON app_users; DROP FUNCTION public.fixture_linked_bookkeeping()'));
    results.push('suppressed-required-bookkeeping-refuses-session-and-audit');

    await reset(); const auditStateKey = await pending(), auditBefore = await state();
    await auditTrigger("RAISE EXCEPTION 'fixture linked audit failure';", async () => {
      const denied = await fetch(baseUrl + '/api/v1/auth/plex/callback?state=' + auditStateKey, { redirect: 'manual' });
      assert.equal(callbackFailure?.code, 'session_write_unavailable', callbackFailure?.stack);
      assert.equal(denied.status, 303); assert.equal(denied.headers.get('set-cookie'), null); assert.match(denied.headers.get('location'), /code=session_write_unavailable/u);
      assert.doesNotMatch(denied.headers.get('location'), /fixture|provider-token|password_hash/u); assert.deepEqual(await state(), auditBefore);
    }); results.push('required-audit-http-redirect-refuses-cookies-and-rolls-back');

    await reset(); const suppressedAuditBefore = await state();
    await auditTrigger('RETURN NULL;', async () => {
      await assert.rejects(loginLinkedUser(proof()), { status: 503 }); assert.deepEqual(await state(), suppressedAuditBefore);
    }); results.push('suppressed-required-audit-rolls-back-session-and-bookkeeping');

    await reset(); const commitBefore = await state(), ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const held = createLinkedLoginService({ startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      try { const value = await work(client, check); ready.resolve(); await release.promise; check(); return value; }
      catch (error) { ready.reject(error); throw error; }
    }) });
    const pendingResult = track(held.loginLinkedUser(proof())); await ready.promise; assert.deepEqual(await state(), commitBefore);
    release.resolve(); releases.delete(release); await pendingResult;
    assert.equal((await state()).tokens, commitBefore.tokens + 1); assert.equal((await state()).audits, commitBefore.audits + 1);
    results.push('bookkeeping-session-audit-invisible-until-commit');

    await reset(); const lostBefore = await state(); let commits = 0;
    const uncertain = createLinkedLoginService({ startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost acknowledgement'); } return value; }; return client;
    } }) }) });
    await assert.rejects(uncertain.loginLinkedUser(proof()), { status: 503 }); assert.equal(commits, 1);
    assert.equal((await state()).tokens, lostBefore.tokens + 1); assert.equal((await state()).audits, lostBefore.audits + 1);
    results.push('real-commit-controlled-ack-loss-no-automatic-retry');

    for (const mode of ['restricted', 'unauthorized', 'empty']) {
      await reset(); const stateKey = await pending(); transportMode = mode; const stable = await state();
      await assert.rejects(callbackService.completeSignIn({ state: stateKey, requestMetadata: metadata })); assert.deepEqual(await state(), stable);
      results.push('controlled-provider-' + mode + '-refuses-before-login-writes');
    }
    await reset(); const successful = await fetch(baseUrl + '/api/v1/auth/plex/callback?state=' + await pending(), { redirect: 'manual' });
    assert.equal(successful.status, 303); assert.equal(successful.headers.get('location'), '/app/activity'); assert.ok(successful.headers.get('set-cookie'));
    results.push('ordinary-callback-delivers-cookies-after-confirmed-commit');

    await reset(); let task, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const stable = await state(), timed = createLinkedLoginService({ startTransactionFn: work => {
        task = startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { timeoutMs: 1_000 }); return task;
      } });
      const refused = assert.rejects(track(timed.loginLinkedUser(proof())), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(), stable);
    }); results.push('deadline-awaits-actual-backend-retirement-and-rolls-back');
  }, async () => {
    for (const release of releases) release.resolve(); await observer.query('ROLLBACK').catch(() => {}); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, networkCalls, providerTransportControlled: true, exactLinkFence: true, candidateReadBounded: true,
    requiredAuditAtomic: true, commitLossControlled: true, actualBackendRetirement: true }));
});
