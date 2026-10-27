/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { createEncryptedSecretService, encryptSecretValue } from '/app/server-dist/encrypted-secret-service.js';
import { createPlexDirectSignInService } from '/app/server-dist/integrations/plex/plex-direct-sign-in-service.js';
import { createPlexCallbackStateService } from '/app/server-dist/integrations/plex/plex-callback-state-service.js';
import { startAuthLookup } from '/app/server-dist/auth-lookup-service.js';
import { plexCallbackSecretName } from '/app/server-dist/integrations/plex/plex-callback-policy.js';
import { createPlexHttpClient } from '/app/server-dist/integrations/plex/plex-http-client.js';
import { readLinkedPlexLoginUser, createLinkedLoginService } from '/app/server-dist/linked-login-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { recordAuditEvent } from '/app/server-dist/audit.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Plex callbacks are browser-bound and consume exact single-use state with local publication', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.HARMONIARR_SECURE_COOKIES = 'false';
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), secrets = createEncryptedSecretService(), results = [], active = new Set(), releases = new Set();
  const binding = Buffer.alloc(32, 1).toString('base64url'), otherBinding = Buffer.alloc(32, 2).toString('base64url'), baseUrl = 'http://127.0.0.1:3000';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-callback' }, subject = 'callback-subject';
  let runtime, userId, callbacks, networkCalls = 0;
  const ownership = new AsyncLocalStorage();
  const trackedPool = { async connect() {
    const context = ownership.getStore(); assert.ok(context);
    const client = await pool.connect(), release = client.release; context.clients++;
    client.release = function (...args) { client.release = release; const result = Reflect.apply(release, this, args); context.clients--; return result; };
    return client;
  } };
  const transport = createPlexHttpClient({ fetchFn: async (url, options) => {
    assert.equal(ownership.getStore()?.clients, 0, 'This callback must release its actual checkout before provider work');
    networkCalls++;
    const parsed = new URL(url); assert.equal(parsed.origin, 'https://plex.tv');
    if (parsed.pathname === '/api/v2/pins') return Response.json({ id: 123, code: 'fixture-pin' });
    if (parsed.pathname === '/api/v2/pins/123') return Response.json({ authToken: 'fixture-token' });
    assert.equal(options.headers['X-Plex-Token'], 'fixture-token'); return Response.json({ id: 123, uuid: subject, restricted: false });
  } });
  const make = options => {
    const callbackStateService = createPlexCallbackStateService({ encryptedSecretService: secrets,
      startReadFn: (work, settings) => startAuthLookup(work, { ...settings, getPoolFn: () => trackedPool }),
      startTransactionFn: (work, settings) => startSessionWriteTransaction(work, { ...settings, getPoolFn: () => trackedPool }) });
    const service = createPlexDirectSignInService({ callbackStateService, plexHttpClient: transport, loadSettingsFn: async () => ({ system: { baseUrl } }), ...options });
    return { startSignIn: input => ownership.run({ clients: 0 }, () => service.startSignIn(input)),
      completeSignIn: input => ownership.run({ clients: 0 }, () => service.completeSignIn(input)) };
  };
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createPlexDirectSignInService: () => ({
    startSignIn: input => track(callbacks.startSignIn(input)), completeSignIn: input => track(callbacks.completeSignIn(input)),
  }) });
  const state = async stateKey => (await observer.query(`SELECT failed_login_count,last_login_at::text,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$1 AND event_type='plex_sign_in_succeeded') AS audits,
    (SELECT count(*)::int FROM encrypted_secrets WHERE secret_type='integration_oauth' AND name=$2) AS pending
    FROM app_users WHERE id=$1`, [userId, plexCallbackSecretName(stateKey)])).rows[0];
  const record = stateKey => secrets.getSecretRecord({ secretType: 'integration_oauth', name: plexCallbackSecretName(stateKey), queryable: observer });
  async function flow(service = callbacks, browserBinding = binding) {
    const started = await service.startSignIn({ browserBinding, redirectTo: '/app/activity', requestMetadata: metadata });
    return new URL(new URLSearchParams(started.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
  }
  const callback = (stateKey, browserBinding = binding) => fetch(baseUrl + '/api/v1/auth/plex/callback?state=' + stateKey,
    { redirect: 'manual', headers: browserBinding ? { cookie: 'harmoniarr_plex_binding=' + browserBinding } : {} });
  async function rewrite(stateKey, delta) {
    const saved = await record(stateKey), value = JSON.parse(secrets.decryptSecretRecord(saved));
    await secrets.setSecretValue({ secretType: 'integration_oauth', name: plexCallbackSecretName(stateKey), plaintextValue: JSON.stringify({ ...value, ...delta }), queryable: observer });
  }
  function gate(count = 1) {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release); let seen = 0;
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, service: make({ findLinkedUserFn: async input => {
      const candidate = await readLinkedPlexLoginUser(input); if (++seen === count) ready.resolve(); await release.promise; return candidate;
    } }) };
  }
  async function trigger(event, body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_callback_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='${event}' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_callback_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_callback_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_callback_audit ON audit_events; DROP FUNCTION public.fixture_callback_audit()'));
  }
  async function until(check) {
    const deadline = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'Callback observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  async function awaitReady(promise) {
    t.signal.throwIfAborted(); let abort;
    try { await Promise.race([promise, new Promise((_, reject) => { abort = () => { reject(t.signal.reason); }; t.signal.addEventListener('abort', abort, { once: true }); })]); }
    finally { t.signal.removeEventListener('abort', abort); }
  }
  await withWorkerTaskCleanup(async () => {
    callbacks = make(); runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    const bootstrap = await fetch(baseUrl + '/api/v1/bootstrap/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'callback-admin', password: 'CallbackFixturePassword123!' }) });
    assert.equal(bootstrap.status, 201); await bootstrap.json();
    userId = (await observer.query("UPDATE app_users SET auth_provider='plex',auth_subject=$1 WHERE username='callback-admin' RETURNING id", [subject])).rows[0].id;

    const started = await fetch(baseUrl + '/api/v1/auth/plex/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect: '/app/activity' }) });
    assert.equal(started.status, 202); assert.equal(started.headers.get('cache-control'), 'no-store'); assert.equal(started.headers.get('referrer-policy'), 'no-referrer');
    const cookie = started.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/u); const dto = await started.json();
    const stateKey = new URL(new URLSearchParams(dto.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
    const browser = decodeURIComponent(cookie.split(';')[0].split('=')[1]); assert.ok(!JSON.stringify(dto).includes(browser));
    const before = await state(stateKey), calls = networkCalls;
    for (const browserBinding of [null, otherBinding]) {
      const refused = await callback(stateKey, browserBinding); assert.equal(refused.status, 303); assert.equal(refused.headers.get('set-cookie'), null); assert.match(refused.headers.get('location'), /plex_sign_in_state_invalid/u);
      assert.equal(networkCalls, calls); assert.deepEqual(await state(stateKey), before);
    }
    results.push('http-start-cookie-no-store-and-other-browser-refusal-before-provider-work');
    const success = await callback(stateKey, browser); assert.equal(success.status, 303); assert.equal(success.headers.get('location'), '/app/activity'); assert.ok(success.headers.get('set-cookie'));
    const after = await state(stateKey); assert.equal(after.pending, 0); assert.equal(after.tokens, before.tokens + 1); assert.equal(after.audits, before.audits + 1);
    const replay = await callback(stateKey, browser); assert.equal(replay.headers.get('set-cookie'), null); assert.deepEqual(await state(stateKey), after);
    results.push('ordinary-callback-atomic-consumption-and-replay-refusal');
    const audit = (await observer.query("SELECT details FROM audit_events WHERE event_type='plex_sign_in_started' ORDER BY occurred_at DESC LIMIT 1")).rows[0];
    assert.ok(!JSON.stringify(audit).includes(stateKey)); assert.ok(!JSON.stringify(audit).includes(browser)); results.push('start-audit-omits-state-and-browser-secrets');

    for (const delta of [{ version: 0 }, { browserBindingHash: undefined }, { expiresAt: 'invalid' }, { expiresAt: '2000-01-01T00:00:00.000Z' }]) {
      const key = await flow(); await rewrite(key, delta); const stable = await state(key), count = networkCalls;
      await assert.rejects(callbacks.completeSignIn({ state: key, browserBinding: binding }), { code: 'plex_sign_in_state_invalid' });
      assert.equal(networkCalls, count); assert.deepEqual(await state(key), stable);
    }
    results.push('legacy-malformed-and-expired-records-refuse-before-provider-work');
    const exhaustedKey = await flow(), holders = [], exhaustedBefore = await state(exhaustedKey), countBefore = networkCalls;
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 4; index++) holders.push(await pool.connect());
      await assert.rejects(callbacks.completeSignIn({ state: exhaustedKey, browserBinding: binding }), { status: 503, code: 'auth_lookup_unavailable' });
    }, () => { for (const client of holders) client.release(); });
    assert.equal(networkCalls, countBefore); assert.deepEqual(await state(exhaustedKey), exhaustedBefore); results.push('bounded-state-read-pool-exhaustion-has-no-provider-or-login-work');

    const leftKey = await flow(), rightKey = await flow();
    await callbacks.completeSignIn({ state: leftKey, browserBinding: binding }); await callbacks.completeSignIn({ state: rightKey, browserBinding: binding });
    assert.equal((await state(leftKey)).pending, 0); assert.equal((await state(rightKey)).pending, 0); results.push('separate-tabs-share-binding-and-consume-independent-states');
    const concurrentGate = gate(2); callbacks = concurrentGate.service; const concurrentKey = await flow(), concurrentBefore = await state(concurrentKey);
    const competing = Promise.all([track(callback(concurrentKey)), track(callback(concurrentKey))]); await awaitReady(concurrentGate.ready); concurrentGate.open(); const responses = await competing;
    assert.equal(responses.filter(response => response.headers.get('set-cookie')).length, 1);
    const concurrentAfter = await state(concurrentKey); assert.equal(concurrentAfter.pending, 0); assert.equal(concurrentAfter.tokens, concurrentBefore.tokens + 1); assert.equal(concurrentAfter.audits, concurrentBefore.audits + 1);
    results.push('concurrent-http-callbacks-one-consumer-one-session-one-audit'); callbacks = make();

    for (const kind of ['revision', 'cipher', 'replacement', 'deletion']) {
      const held = gate(), key = await flow(held.service), pending = track(held.service.completeSignIn({ state: key, browserBinding: binding })); await awaitReady(held.ready);
      const saved = await record(key);
      if (kind === 'revision') await observer.query("UPDATE encrypted_secrets SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1", [saved.id]);
      if (kind === 'cipher') await observer.query('UPDATE encrypted_secrets SET encrypted_value=$2 WHERE id=$1', [saved.id, encryptSecretValue(secrets.decryptSecretRecord(saved), Buffer.alloc(32))]);
      if (kind === 'replacement') await rewrite(key, {});
      if (kind === 'deletion') await observer.query('DELETE FROM encrypted_secrets WHERE id=$1', [saved.id]);
      const stable = await state(key); held.open(); await assert.rejects(pending, { code: 'plex_sign_in_state_invalid' }); assert.deepEqual(await state(key), stable);
      results.push('prepared-callback-refuses-changed-' + kind);
    }
    const expiredGate = gate(), expiryKey = await flow(expiredGate.service);
    const expires = (await observer.query("SELECT clock_timestamp()+interval '1 second' AS expires")).rows[0].expires.toISOString(); await rewrite(expiryKey, { expiresAt: expires });
    const late = track(expiredGate.service.completeSignIn({ state: expiryKey, browserBinding: binding })); await awaitReady(expiredGate.ready);
    await until(async () => (await observer.query('SELECT clock_timestamp()>$1::timestamptz AS expired', [expires])).rows[0].expired);
    const expiredBefore = await state(expiryKey); expiredGate.open(); await assert.rejects(late, { code: 'plex_sign_in_state_invalid' }); assert.deepEqual(await state(expiryKey), expiredBefore);
    results.push('expiry-during-provider-admission-refuses-consumption');

    const retryKey = await flow(), retryBefore = await state(retryKey);
    await trigger('plex_sign_in_succeeded', "RAISE EXCEPTION 'fixture callback audit failed';", async () => {
      const denied = await callback(retryKey); assert.equal(denied.headers.get('set-cookie'), null); assert.deepEqual(await state(retryKey), retryBefore);
    });
    assert.ok((await callback(retryKey)).headers.get('set-cookie')); assert.equal((await state(retryKey)).pending, 0); results.push('required-audit-rollback-restores-state-for-explicit-retry');
    const suppressedKey = await flow(), suppressedBefore = await state(suppressedKey);
    await observer.query(`CREATE FUNCTION public.fixture_callback_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.name='${plexCallbackSecretName(suppressedKey)}' THEN RETURN NULL; END IF; RETURN OLD; END $$;
      CREATE TRIGGER fixture_callback_delete BEFORE DELETE ON encrypted_secrets FOR EACH ROW EXECUTE FUNCTION public.fixture_callback_delete()`);
    await withWorkerTaskCleanup(async () => {
      await assert.rejects(callbacks.completeSignIn({ state: suppressedKey, browserBinding: binding }), { code: 'plex_sign_in_state_invalid' }); assert.deepEqual(await state(suppressedKey), suppressedBefore);
    }, () => observer.query('DROP TRIGGER fixture_callback_delete ON encrypted_secrets; DROP FUNCTION public.fixture_callback_delete()'));
    results.push('suppressed-consumption-cannot-publish-login');

    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const heldLogin = createLinkedLoginService({ startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      try { const result = await work(client, check); ready.resolve(); await release.promise; check(); return result; } catch (error) { ready.reject(error); throw error; }
    }) });
    const heldCallbacks = make({ issueLinkedLogin: heldLogin.loginLinkedUser }), heldKey = await flow(heldCallbacks), heldBefore = await state(heldKey);
    const heldResult = track(heldCallbacks.completeSignIn({ state: heldKey, browserBinding: binding })); await awaitReady(ready.promise); assert.deepEqual(await state(heldKey), heldBefore);
    release.resolve(); releases.delete(release); await heldResult; assert.equal((await state(heldKey)).pending, 0); results.push('state-session-and-audit-invisible-until-commit');

    const finalKey = await flow(), finalExpiry = (await observer.query("SELECT clock_timestamp()+interval '2 seconds' AS expires")).rows[0].expires.toISOString(); await rewrite(finalKey, { expiresAt: finalExpiry });
    const finalBefore = await state(finalKey), expiresLogin = createLinkedLoginService({ recordAuditEventFn: async (event, client) => {
      await recordAuditEvent(event, client); await client.query('SELECT pg_sleep(GREATEST(0,EXTRACT(epoch FROM ($1::timestamptz-clock_timestamp())))+0.05)', [finalExpiry]);
    } });
    await assert.rejects(make({ issueLinkedLogin: expiresLogin.loginLinkedUser }).completeSignIn({ state: finalKey, browserBinding: binding }), { status: 503 });
    assert.deepEqual(await state(finalKey), finalBefore); results.push('final-expiry-rolls-back-consumption-and-all-login-writes');

    let commits = 0;
    const uncertainLogin = createLinkedLoginService({ startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost acknowledgement'); } return value; }; return client;
    } }) }) });
    const uncertainCallbacks = make({ issueLinkedLogin: uncertainLogin.loginLinkedUser }), uncertainKey = await flow(uncertainCallbacks), uncertainBefore = await state(uncertainKey);
    await assert.rejects(uncertainCallbacks.completeSignIn({ state: uncertainKey, browserBinding: binding }), { status: 503 }); assert.equal(commits, 1);
    const uncertainAfter = await state(uncertainKey); assert.equal(uncertainAfter.pending, 0); assert.equal(uncertainAfter.tokens, uncertainBefore.tokens + 1); assert.equal(uncertainAfter.audits, uncertainBefore.audits + 1);
    await assert.rejects(callbacks.completeSignIn({ state: uncertainKey, browserBinding: binding }), { code: 'plex_sign_in_state_invalid' }); assert.deepEqual(await state(uncertainKey), uncertainAfter);
    results.push('real-commit-controlled-ack-loss-consumes-once-without-retry');

    const startBefore = (await observer.query("SELECT count(*)::int AS count FROM encrypted_secrets WHERE name LIKE 'auth.plex.sign_in.pending.%'")).rows[0].count;
    await trigger('plex_sign_in_started', 'RETURN NULL;', async () => {
      const failed = await fetch(baseUrl + '/api/v1/auth/plex/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(failed.status, 503); assert.equal(failed.headers.get('set-cookie'), null); await failed.json();
    });
    assert.equal((await observer.query("SELECT count(*)::int AS count FROM encrypted_secrets WHERE name LIKE 'auth.plex.sign_in.pending.%'")).rows[0].count, startBefore);
    results.push('required-start-audit-failure-rolls-back-state-and-sets-no-cookie');
    const timedKey = await flow(), timedBefore = await state(timedKey); let task, pid;
    await trigger('plex_sign_in_succeeded', 'PERFORM pg_sleep(30);', async () => {
      const timedLogin = createLinkedLoginService({ startTransactionFn: work => { task = startSessionWriteTransaction(async (client, check) => {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check);
      }, { timeoutMs: 1_000 }); return task; } });
      const refused = assert.rejects(track(make({ issueLinkedLogin: timedLogin.loginLinkedUser }).completeSignIn({ state: timedKey, browserBinding: binding })), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(timedKey), timedBefore);
    }); results.push('deadline-restores-state-and-awaits-actual-backend-retirement');
  }, async () => {
    for (const release of releases) release.resolve(); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, browserBound: true, singleUse: true, atomicConsumption: true, exactRecordFence: true, expiryRechecked: true,
    controlledProviderTransport: true, commitLossControlled: true, actualBackendRetirement: true }));
});
