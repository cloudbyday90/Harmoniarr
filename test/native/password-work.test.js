/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { createAuthModule } from '/app/server-dist/auth-module.js';
import { isBootstrapRequired, handleLoginFailure } from '/app/server-dist/auth.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { hashPassword, verifyPassword } from '/app/server-dist/security.js';
import { createPasswordWorkService, getPasswordWorkState } from '/app/server-dist/password-work-service.js';
import { parsePasswordHash } from '/app/server-dist/password-hash-policy.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('password work bounds native dispatch and preserves full credential verification', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const results = [], active = new Set(), releases = new Set(), pool = getPool(), nativeScrypt = promisify(scrypt);
  let runtime, overrideLogin;
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createAuthModule: options => {
    const module = createAuthModule(options), normal = module.routeDependencies.loginUser;
    module.routeDependencies.loginUser = input => track((overrideLogin ?? normal)(input)); return module;
  } });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl), username = 'password-work-admin', password = 'PasswordWorkNativeFixture123!';
  const state = async () => (await pool.query(`SELECT
    (SELECT count(*)::int FROM refresh_tokens) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE event_type='login_failed') AS failures,
    (SELECT count(*)::int FROM audit_events WHERE event_type='login_succeeded') AS successes,
    (SELECT failed_login_count FROM app_users WHERE username=$1) AS failed_login_count`, [username])).rows[0];
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username, password } })).response.status, 201);
    const unicode = '😀'.repeat(64) + ' with spaces ', salt = '0123456789abcdef0123456789abcdef';
    const legacyKey = await nativeScrypt(unicode, salt, 64), legacy = `scrypt$${salt}$${legacyKey.toString('hex')}`;
    assert.equal(await verifyPassword(unicode, legacy), true); assert.equal(await verifyPassword(unicode + 'x', legacy), false);
    results.push('actual-legacy-default-scrypt-and-full-unicode-compatibility');
    for (const candidate of ['x'.repeat(4096), '😀'.repeat(1024)]) {
      const hash = await hashPassword(candidate); assert.equal(await verifyPassword(candidate, hash), true);
      const changed = candidate.startsWith('x') ? candidate.slice(0, -1) + 'y' : '😇' + candidate.slice(2);
      assert.equal(await verifyPassword(changed, hash), false);
    }
    results.push('exact-4096-byte-ascii-and-unicode-without-truncation');

    const rssBefore = process.memoryUsage().rss; let sampledPeak = rssBefore;
    const timer = setInterval(() => { sampledPeak = Math.max(sampledPeak, process.memoryUsage().rss); }, 5);
    await withWorkerTaskCleanup(async () => {
      const first = hashPassword(password), second = verifyPassword(unicode, legacy);
      assert.deepEqual(getPasswordWorkState(), { active: 2, maxConcurrent: 2, pending: 0 });
      await assert.rejects(hashPassword(password), { status: 503, code: 'password_work_busy' });
      await assert.rejects(verifyPassword(unicode, legacy), { status: 503, code: 'password_work_busy' });
      await first; assert.equal(await second, true); assert.equal(getPasswordWorkState().active, 0);
    }, () => clearInterval(timer));
    results.push('shared-real-native-hash-verify-cap-and-zero-queue');
    for (const candidate of ['x'.repeat(4097), '😀'.repeat(1024) + 'x']) {
      await assert.rejects(hashPassword(candidate), { status: 400 }); await assert.rejects(verifyPassword(candidate, legacy), { status: 400 });
    }
    assert.equal(await verifyPassword(password, 'scrypt$malformed$hash'), false); assert.equal(getPasswordWorkState().active, 0);
    results.push('oversize-and-malformed-records-refused-before-admission');

    const gates = [], work = createPasswordWorkService({ deriveFn: () => { const gate = Promise.withResolvers(); gates.push(gate); releases.add(gate); return gate.promise; } });
    const first = track(work.hashPassword(password)), second = track(work.hashPassword(password));
    overrideLogin = createPasswordLoginService({ isBootstrapRequiredFn: isBootstrapRequired, handleLoginFailureFn: handleLoginFailure, verifyPasswordFn: work.verifyPassword }).loginUser;
    await withWorkerTaskCleanup(async () => {
      const before = await state(), busy = await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password } });
      assert.equal(busy.response.status, 503); assert.equal(busy.payload.error.code, 'password_work_busy'); assert.equal(busy.response.headers.get('set-cookie'), null);
      assert.deepEqual(await state(), before); assert.deepEqual(work.getState(), { active: 2, maxConcurrent: 2, pending: 0 });
    }, async () => { overrideLogin = null; for (const gate of gates) { gate.resolve(Buffer.alloc(64)); releases.delete(gate); } await Promise.all([first, second]); });
    results.push('controlled-http-saturation-has-no-counter-audit-or-session-write');

    const beforeOversize = await state();
    const oversized = await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password: 'x'.repeat(4097) } });
    assert.equal(oversized.response.status, 400); assert.equal(oversized.payload.error.code, 'validation_error'); assert.equal(oversized.response.headers.get('set-cookie'), null);
    assert.deepEqual(await state(), beforeOversize); results.push('actual-http-input-bound-refuses-before-authentication-mutations');

    const user = (await pool.query('SELECT password_hash FROM app_users WHERE username=$1', [username])).rows[0];
    const parsed = parsePasswordHash(user.password_hash);
    const key = await nativeScrypt(password, parsed.salt, 64, parsed.profile.parameters);
    const ready = Promise.withResolvers(), release = Promise.withResolvers(), controller = new AbortController(); releases.add(release);
    let loginTask;
    const heldWork = createPasswordWorkService({ deriveFn: () => { ready.resolve(); return release.promise; } });
    const login = createPasswordLoginService({ isBootstrapRequiredFn: isBootstrapRequired, handleLoginFailureFn: handleLoginFailure, verifyPasswordFn: heldWork.verifyPassword });
    overrideLogin = input => { loginTask = login.loginUser(input); return loginTask; };
    const request = fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const disconnected = assert.rejects(request, { name: 'AbortError' });
    await withWorkerTaskCleanup(async () => {
      await Promise.race([ready.promise, request.then(() => { throw new Error('Login completed before work barrier'); })]);
      const before = await state(); controller.abort(); await disconnected; assert.equal(heldWork.getState().active, 1);
      release.resolve(key); releases.delete(release); await loginTask; assert.equal(heldWork.getState().active, 0);
      const after = await state(); assert.equal(after.tokens, before.tokens + 1); assert.equal(after.successes, before.successes + 1);
    }, async () => { release.resolve(key); releases.delete(release); overrideLogin = null; await disconnected; });
    results.push('controlled-disconnect-retains-work-slot-until-completion-and-required-write');
    assert.equal((await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password } })).response.status, 200);
    assert.deepEqual(getPasswordWorkState(), { active: 0, maxConcurrent: 2, pending: 0 });
    results.push('ordinary-production-login-retry-after-retirement');
    t.diagnostic(JSON.stringify({ results, rssBefore, sampledPeakRss: sampledPeak, rssAfter: process.memoryUsage().rss,
      profileGiB: Number(process.env.HARMONIARR_MEMORY_PROFILE_GIB), maxActive: 2, pending: 0, legacyCompatible: true, fullInputVerified: true, admissionRefusalNoWrites: true }));
  }, async () => {
    for (const release of releases) release.resolve(Buffer.alloc(64));
    await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
      runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
    } }); }, closePool);
  });
});
