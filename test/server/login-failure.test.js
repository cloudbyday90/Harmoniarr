/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoginFailureService } from '../../src/server/login-failure-service.js';

const user = () => ({ id: 'user', password_hash: 'accepted-secret-hash', credential_epoch: null, failed_login_count: 99 });
function fixture(options = {}) {
  const queries = [], events = [];
  const current = { ...user(), is_disabled: false, login_locked: false, ...options.current };
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('FROM public.app_users')) return { rows: options.absent ? [] : [current] };
    if (sql.startsWith('UPDATE')) return { rowCount: options.changed ?? 1, rows: [{ failed_login_count: options.nextCount ?? 1 }] };
    return { rows: [] };
  } };
  const service = createLoginFailureService({ startTransactionFn: work => ({ result: Promise.resolve().then(async () => {
    if (options.wait) await options.wait;
    const result = await work(client, () => {}); if (options.commitError) throw options.commitError; return result;
  }) }), recordAuditEventFn: async (event, queryable) => {
    assert.equal(queryable, client); events.push(event); if (options.auditError) throw options.auditError;
  } });
  return { service, queries, events };
}

test('login failure uses current account ownership and required audit on the same transaction', async () => {
  const f = fixture({ nextCount: 5 });
  await f.service.handleLoginFailure(user(), { ipAddress: '127.0.0.1' }, 'Listener');
  assert.equal(f.events.length, 1); assert.equal(f.events[0].eventType, 'login_failed');
  assert.deepEqual(f.events[0].details, { username: 'listener', outcome: 'locked' });
  assert.equal(f.events[0].actorType, 'anonymous');
  assert.ok(f.queries[0].sql.includes('FOR NO KEY UPDATE'));
  assert.deepEqual(f.queries.find(row => row.sql.startsWith('UPDATE')).values, ['user', 5, 900]);
  assert.doesNotMatch(JSON.stringify(f.events), /accepted-secret-hash|password_hash|credential_epoch|failed_login_count/u);
});

test('unknown, disabled, deleted, locked, stale and valid-password refusals audit without incrementing', async () => {
  for (const [options, source, policy, outcome] of [
    [{}, null, {}, 'unknown_account'], [{ absent: true }, user(), {}, 'account_unavailable'],
    [{ current: { is_disabled: true } }, user(), {}, 'account_unavailable'],
    [{ current: { login_locked: true } }, user(), {}, 'already_locked'],
    [{ current: { password_hash: 'changed' } }, user(), {}, 'stale_credentials'],
    [{ current: { credential_epoch: '2026-01-01 00:00:00.000200+00' } }, { ...user(), credential_epoch: '2026-01-01 00:00:00.000100+00' }, {}, 'stale_credentials'],
    [{}, user(), { countFailure: false }, 'refused'],
  ]) {
    const f = fixture(options);
    await f.service.handleLoginFailure(source, {}, 'listener', policy);
    assert.equal(f.events[0].details.outcome, outcome);
    assert.ok(!f.queries.some(row => row.sql.startsWith('UPDATE')));
    if (!source) assert.equal(f.queries.length, 0);
  }
});

test('login failure captures credential facts and bounds selected audit metadata before waits', async () => {
  const gate = Promise.withResolvers(), f = fixture({ wait: gate.promise });
  const source = user(), metadata = { ipAddress: 'fe80::1%zone', userAgent: 'x'.repeat(700), password: 'private-password' };
  const pending = f.service.handleLoginFailure(source, metadata, 'a'.repeat(400) + '@example.test');
  source.id = 'changed'; source.password_hash = 'changed'; source.credential_epoch = 'changed'; metadata.userAgent = 'changed'; gate.resolve();
  await pending;
  assert.equal(f.events[0].ipAddress, null); assert.equal(f.events[0].userAgent.length, 512);
  assert.equal(f.events[0].details.username.length, 320); assert.equal(f.events[0].details.outcome, 'counted');
  assert.equal(f.queries.find(row => row.sql.startsWith('UPDATE')).values[0], 'user');
  assert.doesNotMatch(JSON.stringify(f.events), /private-password|accepted-secret-hash/u);
});

test('counter admission, required audit and commit failures are propagated without retry', async () => {
  for (const options of [{ changed: 0 }, { auditError: new Error('required audit') }, { commitError: new Error('uncertain commit') }]) {
    const f = fixture(options); await assert.rejects(f.service.handleLoginFailure(user(), {}, 'listener'));
    assert.equal(f.queries.filter(row => row.sql.startsWith('UPDATE')).length, 1);
    assert.equal(f.events.length, options.changed === 0 ? 0 : 1);
  }
});
