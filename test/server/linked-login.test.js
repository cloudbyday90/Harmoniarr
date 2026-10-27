/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLinkedLoginService } from '../../src/server/linked-login-service.js';
import { selectLinkedLoginIdentity, selectPlexLoginSubjects } from '../../src/server/linked-login-policy.js';
import { findLinkedPlexLoginUser } from '../../src/server/linked-login-store.js';

const input = () => ({ userId: 'user', provider: 'plex', subject: 'verified-subject', requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'original' } });
function fixture(options = {}) {
  const current = { id: 'user', auth_provider: 'plex', auth_subject: 'verified-subject', is_disabled: false, ...options.current };
  const queries = [], events = []; let transactions = 0;
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('FROM public.app_users')) return { rows: options.absent ? [] : [current] };
    if (sql.startsWith('UPDATE')) return { rowCount: options.noUpdate ? 0 : 1,
      rows: [{ id: 'user', username: 'listener', role: 'requester', must_change_password: true, last_login_at: 'database-time' }] };
    if (sql.startsWith('INSERT')) return { rows: [{ id: 'token' }] };
    return { rows: [] };
  } };
  const service = createLinkedLoginService({ startTransactionFn: work => { transactions++; return { result: Promise.resolve().then(async () => {
    if (options.before) await options.before(); const result = await work(client, () => {}); if (options.commitError) throw options.commitError; return result;
  }) }; }, recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); events.push(event); if (options.auditError) throw options.auditError; } });
  return { service, queries, events, transactions: () => transactions };
}

test('linked login atomically publishes current public state, bookkeeping and required audit', async () => {
  const f = fixture(), result = await f.service.loginLinkedUser(input());
  assert.equal(f.transactions(), 1); assert.match(f.queries[0].sql, /FOR NO KEY UPDATE/u);
  assert.equal(result.user.role, 'requester'); assert.equal(result.issuedSession.user.mustChangePassword, true);
  assert.equal(result.user.last_login_at, result.issuedSession.user.lastLoginAt);
  assert.equal(f.events[0].eventType, 'plex_sign_in_succeeded'); assert.equal(f.events[0].userAgent, 'original');
  assert.equal(f.events[0].required, true);
  assert.doesNotMatch(JSON.stringify({ user: result.user, events: f.events }), /verified-subject|auth_subject|password_hash|tokenHash|csrfToken/u);
});

test('linked login snapshots provider identity and audit metadata before transaction waits', async () => {
  const request = input(), f = fixture({ before: async () => {
    request.subject = 'changed'; request.userId = 'changed'; request.provider = 'local'; request.requestMetadata.userAgent = 'changed';
  } });
  await f.service.loginLinkedUser(request);
  assert.equal(f.events[0].userAgent, 'original'); assert.deepEqual(f.queries[1].values, ['user']);
});

test('linked login refuses removed links, changed providers/subjects, missing and disabled accounts before writes', async () => {
  for (const options of [{ absent: true }, { current: { auth_provider: 'local' } }, { current: { auth_subject: null } },
    { current: { auth_subject: 'other-subject' } }, { current: { is_disabled: true } }]) {
    const f = fixture(options); await assert.rejects(f.service.loginLinkedUser(input()), { status: 403 });
    assert.ok(!f.queries.some(row => /^(UPDATE|INSERT)/u.test(row.sql))); assert.equal(f.events.length, 0);
  }
});

test('linked login requires an allowlisted provider and bounded exact subject before admission', async () => {
  for (const delta of [{ provider: 'local' }, { provider: 'unknown' }, { subject: '' }, { subject: ' padded ' }, { subject: 'x'.repeat(257) }, { userId: null }]) {
    const f = fixture(); await assert.rejects(f.service.loginLinkedUser({ ...input(), ...delta }), { status: 403, code: 'plex_sign_in_not_linked' });
    assert.equal(f.transactions(), 0);
  }
  assert.deepEqual(selectLinkedLoginIdentity(input()), { provider: 'plex', subject: 'verified-subject', userId: 'user' });
  for (const value of [null, undefined]) {
    const f = fixture(); await assert.rejects(f.service.loginLinkedUser(value), { status: 403 }); assert.equal(f.transactions(), 0);
  }
});

test('bookkeeping refusal, audit failure and uncertain commit never publish credentials or retry', async () => {
  for (const options of [{ noUpdate: true }, { auditError: new Error('audit failure') }, { commitError: new Error('uncertain commit') }]) {
    const f = fixture(options); await assert.rejects(f.service.loginLinkedUser(input())); assert.equal(f.transactions(), 1);
    if (options.noUpdate) assert.ok(!f.queries.some(row => row.sql.startsWith('INSERT')));
  }
});

test('Plex lookup keeps UUID preference, exact numeric fallback and a minimal bounded result', async () => {
  assert.deepEqual(selectPlexLoginSubjects({ plexUuid: 'uuid', plexId: '123' }), ['uuid', '123']);
  assert.deepEqual(selectPlexLoginSubjects({ plexUuid: '123', plexId: '123' }), ['123']);
  assert.deepEqual(selectPlexLoginSubjects({ plexId: '123' }), ['123']);
  for (const value of [null, undefined, {}, { plexId: 123 }, { plexUuid: 'x'.repeat(257), plexId: '123' }]) assert.deepEqual(selectPlexLoginSubjects(value), []);
  const queries = [], candidate = { id: 'user', auth_provider: 'plex', auth_subject: 'uuid' };
  const result = await findLinkedPlexLoginUser({ query: async (sql, values) => { queries.push({ sql, values }); return { rows: [candidate] }; } }, ['uuid', '123']);
  assert.equal(result, candidate); assert.deepEqual(queries[0].values, [['uuid', '123']]);
  assert.match(queries[0].sql, /array_position/u); assert.match(queries[0].sql, /LIMIT 1/u);
  assert.doesNotMatch(queries[0].sql, /SELECT \*|password_hash/u);
});
