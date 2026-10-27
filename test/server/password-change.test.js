/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordChangeService } from '../../src/server/password-change-service.js';
import { formatCurrentPasswordHash } from '../../src/server/password-hash-policy.js';

const replacement = formatCurrentPasswordHash('a'.repeat(32), Buffer.alloc(64));
const input = () => ({ currentPassword: 'CurrentPassword123!', newPassword: 'NextPassword123!',
  session: { appUserId: 'user', refreshTokenId: 'parent', tokenFamilyId: 'family', refreshToken: 'private-refresh' },
  requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'original' } });
function fixture(options = {}) {
  const accepted = { id: 'user', password_hash: 'verified-hash', credential_epoch: '2026-01-01 00:00:00.000100+00', ...options.accepted };
  const current = { ...accepted, ...options.current };
  const parent = { unexpired: true, current_password: true, is_revoked: false, replaced_by_refresh_token_id: null, ...options.parent };
  const queries = [], events = [], reads = [], verifications = [];
  let transactions = 0, hashes = 0;
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('FROM public.app_users')) return { rows: options.absent ? [] : [current] };
    if (sql.includes('AS refresh_token_id')) return { rows: options.noParent ? [] : [parent] };
    if (sql.startsWith('SELECT expires_at')) return { rows: [{ unexpired: !options.finalExpired }] };
    if (sql.startsWith('SELECT EXISTS')) return { rows: [{ active: options.residualActive ?? false }] };
    if (sql.startsWith('UPDATE public.app_users')) return { rowCount: options.casMiss ? 0 : 1,
      rows: [{ id: 'user', username: 'listener', role: options.role ?? 'requester', must_change_password: false, last_login_at: 'last-login' }] };
    if (sql.startsWith('UPDATE public.refresh_tokens')) return { rowCount: options.noRevocations ? 0 : 3 };
    if (sql.startsWith('INSERT')) return { rows: [{ id: 'replacement-session' }] };
    return { rows: [] };
  } };
  const service = createPasswordChangeService({ readUserFn: async (...args) => { reads.push(args); return options.missing ? null : accepted; },
    verifyPasswordFn: async (...args) => { verifications.push(args); return options.verify ? options.verify(...args) : args[0] === input().currentPassword; },
    hashPasswordFn: async value => { hashes++; assert.equal(transactions, 0); return options.hash ? options.hash(value) : replacement; },
    startTransactionFn: work => { transactions++; return { result: Promise.resolve().then(async () => {
      const result = await work(client, () => {}); if (options.commitError) throw options.commitError; return result;
    }) }; },
    recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); events.push(event); if (options.auditError) throw options.auditError; } });
  return { service, accepted, current, queries, events, reads, verifications, transactions: () => transactions, hashes: () => hashes };
}

test('password change owns guarded credential, all-session revocation, replacement and audit on one client', async () => {
  const f = fixture(), result = await f.service.changePassword(input());
  assert.equal(result.user.role, 'requester'); assert.equal(result.user.must_change_password, false);
  assert.equal(result.issuedSession.user.lastLoginAt, 'last-login'); assert.equal(f.transactions(), 1); assert.equal(f.hashes(), 1);
  assert.deepEqual(f.verifications, [[input().currentPassword, 'verified-hash'], [input().newPassword, 'verified-hash']]);
  assert.match(f.queries[0].sql, /FOR NO KEY UPDATE/u);
  const update = f.queries.find(row => row.sql.startsWith('UPDATE public.app_users'));
  assert.deepEqual(update.values, ['user', replacement, 'verified-hash', f.accepted.credential_epoch]);
  assert.match(update.sql, /password_changed_at IS NOT DISTINCT FROM \$4::timestamptz/u);
  assert.match(update.sql, /password_changed_at=clock_timestamp\(\)/u);
  assert.deepEqual(f.events[0].details, { revokedSessionCount: 3 }); assert.equal(f.events[0].eventType, 'password_changed');
  assert.doesNotMatch(JSON.stringify({ user: result.user, events: f.events }), /verified-hash|scrypt\$|private-refresh|tokenHash|credential_epoch/u);
  assert.equal(f.queries.at(-1).sql.startsWith('SELECT expires_at'), true);
});

test('password change captures credentials, session identity and metadata before asynchronous password work', async () => {
  const ready = Promise.withResolvers(), release = Promise.withResolvers();
  const f = fixture({ verify: async value => { if (value === input().currentPassword) { ready.resolve(); await release.promise; return true; } return false; } });
  const request = input(), pending = f.service.changePassword(request); await ready.promise;
  f.accepted.password_hash = 'changed'; f.accepted.credential_epoch = null; f.accepted.id = 'changed';
  request.session.refreshTokenId = 'changed'; request.session.tokenFamilyId = 'changed'; request.session.appUserId = 'changed';
  request.requestMetadata.userAgent = 'changed'; release.resolve(); await pending;
  const parent = f.queries.find(row => row.sql.includes('AS refresh_token_id'));
  assert.deepEqual(parent.values.slice(0, 3), ['parent', 'user', 'family']); assert.equal(f.events[0].userAgent, 'original');
});

test('password change refuses absent, disabled, stale hash and exact epoch drift before mutation', async () => {
  for (const options of [{ absent: true }, { current: { is_disabled: true } }, { current: { password_hash: 'changed' } },
    { current: { credential_epoch: '2026-01-01 00:00:00.000200+00' } }, { current: { credential_epoch: null } },
    { accepted: { credential_epoch: null }, current: { credential_epoch: 'changed' } }]) {
    const f = fixture(options); await assert.rejects(f.service.changePassword(input()), { status: 401 });
    assert.ok(!f.queries.some(row => /^(UPDATE|INSERT)/u.test(row.sql))); assert.equal(f.events.length, 0);
  }
});

test('password change revalidates the exact active parent under account/family/row ownership', async () => {
  for (const options of [{ noParent: true }, { parent: { is_revoked: true } }, { parent: { unexpired: false } },
    { parent: { current_password: false } }, { parent: { replaced_by_refresh_token_id: 'child' } }]) {
    const f = fixture(options); await assert.rejects(f.service.changePassword(input()), { status: 401, code: 'auth_required' });
    assert.ok(!f.queries.some(row => /^(UPDATE|INSERT)/u.test(row.sql))); assert.equal(f.events.length, 0);
  }
});

test('password change refuses invalid identity, unavailable account, wrong or unchanged password before transaction', async () => {
  for (const options of [{ missing: true }, { accepted: { is_disabled: true } }, { verify: async () => false }, { verify: async () => true }]) {
    const f = fixture(options); await assert.rejects(f.service.changePassword(input()));
    assert.equal(f.hashes(), 0); assert.equal(f.transactions(), 0);
  }
  for (const session of [null, {}, { ...input().session, refreshToken: '' }, { ...input().session, tokenFamilyId: null }]) {
    const f = fixture(); await assert.rejects(f.service.changePassword({ ...input(), session }), { status: 401 }); assert.equal(f.reads.length, 0);
  }
});

test('password change rejects invalid prepared hashes or overload without SQL publication', async () => {
  for (const value of [null, undefined, 'invalid', replacement.replace('p=5', 'p=1')]) {
    const f = fixture({ hash: async () => value });
    await assert.rejects(f.service.changePassword(input()), { status: 503, code: 'password_work_unavailable' }); assert.equal(f.transactions(), 0);
  }
  const busy = Object.assign(new Error('busy'), { status: 503, code: 'password_work_busy' });
  const f = fixture({ hash: async () => { throw busy; } }); await assert.rejects(f.service.changePassword(input()), error => error === busy);
  assert.equal(f.transactions(), 0);
});

test('CAS miss, required audit failure, final parent expiry and commit uncertainty never return credentials or retry', async () => {
  for (const options of [{ casMiss: true }, { noRevocations: true }, { residualActive: true }, { auditError: new Error('audit failure') }, { finalExpired: true }, { commitError: new Error('uncertain commit') }]) {
    const f = fixture(options); await assert.rejects(f.service.changePassword(input()));
    assert.equal(f.transactions(), 1); assert.equal(f.hashes(), 1);
    if (options.casMiss) { assert.equal(f.events.length, 0); assert.ok(!f.queries.some(row => row.sql.startsWith('INSERT'))); }
  }
});

test('preliminary lookup accepts cancellation without passing browser lifetime into security writes', async () => {
  const controller = new AbortController(), f = fixture({ verify: async value => { controller.abort(); return value === input().currentPassword; } });
  await f.service.changePassword({ ...input(), signal: controller.signal });
  assert.equal(f.reads[0][1].signal, controller.signal); assert.equal(f.transactions(), 1);
});
