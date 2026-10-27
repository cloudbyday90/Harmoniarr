/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionIssuanceService } from '../../src/server/session-issuance-service.js';
import { createSessionMaterial } from '../../src/server/session-issuance-policy.js';
import { sessionFamilyLockKey } from '../../src/server/session-family-lock-store.js';
import { hashToken } from '../../src/server/security.js';

const session = () => ({ refreshTokenId: 'parent', appUserId: 'user', tokenFamilyId: 'family', refreshToken: 'raw-parent' });
function fixture(options = {}) {
  const queries = [], events = [], replays = [];
  const owner = { id: 'user', username: 'fixture', role: 'requester', must_change_password: false,
    is_disabled: false, password_changed_at: null, ...options.owner };
  const parent = { unexpired: true, current_password: true, is_revoked: false, ...options.parent };
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('FROM public.app_users')) return { rows: options.noOwner ? [] : [owner] };
    if (sql.includes('FOR UPDATE')) return { rows: options.noParent ? [] : [parent] };
    if (sql.startsWith('INSERT')) return { rows: [{ id: 'child' }] };
    if (sql.startsWith('UPDATE')) return { rowCount: options.changed ?? 1 };
    return { rows: [{ unexpired: options.finalUnexpired ?? true }] };
  } };
  const startTransactionFn = work => ({ result: Promise.resolve().then(async () => {
    if (options.wait) await options.wait;
    const result = await work(client, () => {});
    if (options.commitError) throw options.commitError;
    return result;
  }) });
  const service = createSessionIssuanceService({ startTransactionFn,
    recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); events.push(event); },
    applyReplayFn: async (...args) => { replays.push(args); return 1; } });
  return { service, queries, events, replays, client };
}

test('rotation captures source inputs, uses ordered account/family/parent locks and publishes current user', async () => {
  const gate = Promise.withResolvers(), f = fixture({ wait: gate.promise }), accepted = session();
  const metadata = { ipAddress: 'invalid', userAgent: 'original' };
  const pending = f.service.rotateSession(accepted, metadata);
  accepted.refreshTokenId = 'changed'; accepted.tokenFamilyId = 'changed'; metadata.userAgent = 'changed'; gate.resolve();
  const issued = await pending;
  assert.equal(issued.user.role, 'requester'); assert.equal(issued.tokenFamilyId, 'family');
  const parent = f.queries.find(row => row.sql.includes('FOR UPDATE'));
  assert.deepEqual(parent.values.slice(0, 4), ['parent', 'user', 'family', hashToken('raw-parent')]);
  const familyIndex = f.queries.findIndex(row => row.sql.includes('pg_advisory_xact_lock'));
  assert.ok(f.queries[0].sql.includes('FOR SHARE')); assert.ok(familyIndex > 0);
  assert.ok(familyIndex < f.queries.findIndex(row => row === parent));
  assert.equal(f.events[0].entityId, 'parent'); assert.equal(f.events[0].ipAddress, null); assert.equal(f.events[0].userAgent, 'original');
  assert.equal(f.events[0].eventType, 'session_rotated');
  assert.doesNotMatch(JSON.stringify(f.events), /raw-parent|csrfToken|tokenHash/u);
  assert.notEqual(issued.refreshToken, 'raw-parent'); assert.equal(issued.refreshTokenId, 'child');
});

test('rotation refuses changed account, parent, expiry, credential epoch and token binding before insertion', async () => {
  for (const options of [{ noOwner: true }, { owner: { is_disabled: true } }, { noParent: true },
    { parent: { unexpired: false } }, { parent: { current_password: false } }, { parent: { is_revoked: true } }]) {
    const f = fixture(options);
    await assert.rejects(f.service.rotateSession(session(), {}), { status: 401 });
    assert.ok(!f.queries.some(row => row.sql.startsWith('INSERT'))); assert.equal(f.events.length, 0);
  }
  const forced = fixture({ owner: { must_change_password: true } });
  await assert.rejects(forced.service.rotateSession(session(), {}), { status: 403, code: 'reauth_required' });
  const missing = fixture();
  await assert.rejects(missing.service.rotateSession({ ...session(), refreshToken: null }, {}), { status: 401 });
});

test('a second redemption handles replay on the original transaction and never returns new credentials', async () => {
  const f = fixture({ parent: { is_revoked: true, replaced_by_refresh_token_id: 'existing-child' } });
  await assert.rejects(f.service.rotateSession(session(), {}), { status: 401 });
  assert.equal(f.replays.length, 1); assert.equal(f.replays[0][0], f.client);
  assert.ok(!f.queries.some(row => row.sql.startsWith('INSERT')));
});

test('parent CAS, final expiry and commit failures never publish generated credentials', async () => {
  for (const options of [{ changed: 0 }, { finalUnexpired: false }, { commitError: new Error('lost commit') }]) {
    const f = fixture(options); await assert.rejects(f.service.rotateSession(session(), {}));
  }
});

test('root issuance makes a new family and refuses descendant grafts before checkout', async () => {
  const f = fixture();
  const issued = await f.service.issueRootSession({ userId: 'user', requestMetadata: { ipAddress: '::1' } });
  assert.match(issued.tokenFamilyId, /^[a-f0-9-]{36}$/u);
  assert.equal(f.queries.find(row => row.sql.startsWith('INSERT')).values[3], null);
  const count = f.queries.length;
  for (const extra of [{ parentRefreshTokenId: 'parent' }, { tokenFamilyId: issued.tokenFamilyId }]) {
    await assert.rejects(f.service.issueRootSession({ userId: 'user', ...extra }), TypeError);
    assert.equal(f.queries.length, count);
  }
  const disabled = fixture({ owner: { is_disabled: true } });
  await assert.rejects(disabled.service.issueRootSession({ userId: 'user' }), { status: 401 });
});

test('token material remains private and family lock keys canonicalize UUID text', () => {
  const first = createSessionMaterial(), second = createSessionMaterial();
  assert.notEqual(first.tokenFamilyId, second.tokenFamilyId); assert.notEqual(first.refreshToken, second.refreshToken);
  assert.equal(first.tokenHash, hashToken(first.refreshToken)); assert.equal(first.csrfTokenHash, hashToken(first.csrfToken));
  assert.equal(sessionFamilyLockKey(first.tokenFamilyId), sessionFamilyLockKey(first.tokenFamilyId.toUpperCase()));
  assert.notEqual(sessionFamilyLockKey(first.tokenFamilyId), sessionFamilyLockKey(second.tokenFamilyId));
});
