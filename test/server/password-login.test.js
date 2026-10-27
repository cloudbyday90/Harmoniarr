/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordLoginService } from '../../src/server/password-login-service.js';

const input = () => ({ username: 'Listener', password: 'LoginFixturePassword123!', requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'original' } });
function fixture(options = {}) {
  const accepted = { id: 'user', username: 'listener', password_hash: 'accepted-hash', credential_epoch: null,
    is_disabled: false, login_locked: false, failed_login_count: 3, ...options.accepted };
  const current = { ...accepted, role: 'requester', must_change_password: true, ...options.current };
  const queries = [], events = [], failures = [], lookups = [], reads = [];
  let transactions = 0;
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('FROM public.app_users')) return { rows: options.absent ? [] : [current] };
    if (sql.startsWith('UPDATE')) return { rowCount: 1, rows: [{ id: current.id, username: current.username,
      role: current.role, must_change_password: current.must_change_password, last_login_at: 'now' }] };
    if (sql.startsWith('INSERT')) return { rows: [{ id: 'token' }] };
    return { rows: [] };
  } };
  const service = createPasswordLoginService({ isBootstrapRequiredFn: async readOptions => { reads.push(readOptions); return options.bootstrap ?? false; },
    findUserFn: async (identifier, readOptions) => { reads.push(readOptions); lookups.push(identifier); return options.missing ? null : accepted; },
    verifyPasswordFn: async (...args) => { if (options.verify) return options.verify(...args); return options.valid ?? true; },
    handleLoginFailureFn: async (...args) => { failures.push(args); },
    startTransactionFn: work => { transactions++; return { result: Promise.resolve().then(async () => {
      const result = await work(client, () => {});
      if (options.commitError) throw options.commitError;
      return result;
    }) }; },
    recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); events.push(event); if (options.auditError) throw options.auditError; } });
  return { service, accepted, queries, events, failures, lookups, reads, transactions: () => transactions };
}

test('password login publishes current role/forced-change state and an audit without credential secrets', async () => {
  const f = fixture();
  const result = await f.service.loginUser(input());
  assert.equal(result.user.role, 'requester'); assert.equal(result.issuedSession.user.mustChangePassword, true);
  assert.equal(result.user.last_login_at, result.issuedSession.user.lastLoginAt);
  assert.deepEqual(f.lookups, ['listener']); assert.equal(f.transactions(), 1);
  assert.equal(f.events[0].eventType, 'login_succeeded'); assert.equal(f.events[0].actorUserId, 'user');
  assert.doesNotMatch(JSON.stringify({ user: result.user, events: f.events }), /accepted-hash|password_hash|credential_epoch|csrfToken|refreshToken/u);
  assert.ok(f.queries[0].sql.includes('FOR NO KEY UPDATE'));
});

test('password login captures verification facts and metadata before asynchronous verification', async () => {
  const started = Promise.withResolvers(), gate = Promise.withResolvers();
  const f = fixture({ verify: async (password, hash) => { assert.equal(hash, 'accepted-hash'); started.resolve(); await gate.promise; return password === input().password; } });
  const request = input(), pending = f.service.loginUser(request);
  await started.promise;
  f.accepted.password_hash = 'mutated'; f.accepted.credential_epoch = 'mutated'; f.accepted.id = 'other';
  request.requestMetadata.userAgent = 'changed'; gate.resolve();
  const result = await pending;
  assert.equal(result.user.id, 'user'); assert.equal(f.events[0].userAgent, 'original');
});

test('password login refuses stale hash/epoch and current account restrictions before writes', async () => {
  for (const options of [{ absent: true }, { current: { is_disabled: true } },
    { current: { password_hash: 'changed' } }, { current: { credential_epoch: 'changed' } },
    { accepted: { credential_epoch: '2026-01-01 00:00:00.000100+00' }, current: { credential_epoch: '2026-01-01 00:00:00.000200+00' } },
    { current: { login_locked: true } }]) {
    const f = fixture(options);
    await assert.rejects(f.service.loginUser(input()), { status: options.current?.login_locked ? 423 : 401 });
    assert.ok(!f.queries.some(row => /^(UPDATE|INSERT)/u.test(row.sql))); assert.equal(f.events.length, 0);
    assert.equal(f.failures.length, 1); assert.deepEqual(f.failures[0][3], { countFailure: false });
  }
});

test('bootstrap, unavailable account, lockout and wrong password never enter issuance', async () => {
  for (const options of [{ bootstrap: true }, { missing: true }, { accepted: { is_disabled: true } },
    { accepted: { login_locked: true } }, { valid: false }]) {
    const f = fixture(options);
    await assert.rejects(f.service.loginUser(input()), { status: options.bootstrap ? 409 : options.accepted?.login_locked ? 423 : 401 });
    assert.equal(f.transactions(), 0);
    assert.equal(f.failures.length, options.bootstrap ? 0 : 1);
  }
});

test('wrong-password failure receives immutable accepted credentials rather than the mutable lookup row', async () => {
  const gate = Promise.withResolvers(), ready = Promise.withResolvers();
  const f = fixture({ verify: async () => { ready.resolve(); await gate.promise; return false; } });
  const pending = f.service.loginUser(input());
  await ready.promise;
  f.accepted.id = 'changed'; f.accepted.password_hash = 'changed'; f.accepted.credential_epoch = 'changed'; gate.resolve();
  await assert.rejects(pending, { status: 401 });
  assert.deepEqual(f.failures[0][0], { id: 'user', password_hash: 'accepted-hash', credential_epoch: null });
  assert.equal(f.failures[0][3], undefined);
});

test('required audit or commit failure cannot return generated session credentials', async () => {
  for (const options of [{ auditError: new Error('audit failed') }, { commitError: new Error('commit uncertain') }]) {
    const f = fixture(options); await assert.rejects(f.service.loginUser(input()));
    assert.equal(f.events.length, 1); assert.equal(f.transactions(), 1);
  }
});

test('preliminary read cancellation is not passed to hashing or the admitted security-write owner', async () => {
  const controller = new AbortController(), f = fixture({ verify: async () => { controller.abort(); return true; } });
  const result = await f.service.loginUser({ ...input(), signal: controller.signal });
  assert.deepEqual(f.reads, [{ signal: controller.signal }, { signal: controller.signal }]);
  assert.equal(controller.signal.aborted, true); assert.equal(f.transactions(), 1); assert.equal(result.user.id, 'user');
});
