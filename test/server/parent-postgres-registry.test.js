/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { createParentPostgresRegistry } from '../../testing/integration/parent-postgres-registry.js';
import { parentPostgresError } from '../../testing/integration/parent-postgres-store.js';

const record = (action, fields = {}, pid = 123) => ({ version: 1, pid, action, ...fields });
function fixture({ onInspect = null, onReap = null, nameFactory = null } = {}) {
  const databases = new Map(); const calls = []; let active = 0; let maxActive = 0; let names = 0;
  const store = {
    async inspect(name) {
      active += 1; maxActive = Math.max(active, maxActive); calls.push(['inspect', name]);
      try { await onInspect?.(name); return databases.has(name) ? { ...databases.get(name) } : null; }
      finally { active -= 1; }
    },
    async reap(name, oid) {
      active += 1; maxActive = Math.max(active, maxActive); calls.push(['reap', name, oid]);
      try { await onReap?.(name, oid); databases.delete(name); }
      finally { active -= 1; }
    },
  };
  const registry = createParentPostgresRegistry({ store, nameFactory: nameFactory ?? (() => `case_${++names}`) });
  const scope = registry.beginScope();
  const dispatch = (action, fields = {}, pid) => registry.dispatch(scope.token, record(action, fields, pid));
  const reserve = async (kind = 'scenario', pid) => (await dispatch('reserve', { kind }, pid)).databaseName;
  const commit = async (name, oid = '41', pid) => {
    databases.set(name, { oid, owned: true, activeCount: 0 });
    return dispatch('commit', { databaseName: name, oid }, pid);
  };
  return { registry, scope, databases, calls, dispatch, reserve, commit, maxActive: () => maxActive };
}

test('one active scope issues a strict bearer capability and stale or malformed capabilities never reach SQL', async () => {
  const f = fixture(); assert.match(f.scope.token, /^[a-f0-9]{64}$/u); assert.equal(f.registry.authenticate(f.scope.token), true);
  assert.throws(() => f.registry.beginScope(), { code: 'fixture_parent_scope_active' });
  for (const token of [null, '', 'a'.repeat(63), 'a'.repeat(64), f.scope.token.toUpperCase()]) {
    assert.equal(f.registry.authenticate(token), false);
    await assert.rejects(f.registry.dispatch(token, record('reserve', { kind: 'scenario' })), { code: 'fixture_parent_authentication_failed' });
  }
  assert.equal(f.calls.length, 0);
});

test('records require exact primitive version, PID, action and field shape before store work', async () => {
  const f = fixture();
  const variants = [null, { ...record('reserve', { kind: 'scenario' }), version: 2 }, record('reserve', { kind: 'scenario' }, 0),
    record('reserve', { kind: 'scenario' }, 2_147_483_648), record('reserve', { kind: 'scenario', databaseName: 'caller_name' }),
    record('reserve', { kind: 'unknown' }), record('unknown'), record('commit', { databaseName: 'case_1', oid: '0' }),
    record('abandon', { databaseName: 'case_1', oid: '41' })];
  for (const value of variants) await assert.rejects(f.registry.dispatch(f.scope.token, value), { code: 'fixture_parent_record_invalid' });
  const getter = { pid: 123, action: 'reserve', kind: 'scenario' };
  Object.defineProperty(getter, 'version', { get() { throw new Error('private-token-canary'); } });
  await assert.rejects(f.registry.dispatch(f.scope.token, getter), (error) => {
    assert.equal(error.code, 'fixture_parent_record_invalid'); assert.doesNotMatch(error.message, /private-token/u); return true;
  });
  assert.equal(f.calls.length, 0); assert.deepEqual(f.registry.workerPids(f.scope.token), []);
});

test('the parent allocates absent names and refuses collisions or arbitrary caller names', async () => {
  const f = fixture({ nameFactory: () => 'existing_case' });
  f.databases.set('existing_case', { oid: '99', owned: false, activeCount: 1 });
  await assert.rejects(f.reserve(), { code: 'fixture_parent_reservation_collision' });
  f.databases.delete('existing_case'); const name = await f.reserve(); assert.equal(name, 'existing_case');
  await assert.rejects(f.reserve(), { code: 'fixture_parent_reservation_collision' });
  const count = f.calls.length;
  await assert.rejects(f.dispatch('commit', { databaseName: 'unreserved_sibling', oid: '99' }), { code: 'fixture_parent_unregistered_database' });
  assert.equal(f.calls.length, count);
});

test('commit retries are idempotent only for the reserved PID and fresh matching OID/current role', async () => {
  const f = fixture(); const name = await f.reserve(); await f.commit(name);
  assert.deepEqual(await f.dispatch('commit', { databaseName: name, oid: '41' }), { databaseName: name, oid: '41' });
  await assert.rejects(f.dispatch('commit', { databaseName: name, oid: '42' }), { code: 'fixture_parent_identity_changed' });
  await assert.rejects(f.dispatch('commit', { databaseName: name, oid: '41' }, 124), { code: 'fixture_parent_unregistered_database' });
  f.databases.get(name).owned = false;
  await assert.rejects(f.dispatch('assert', { databaseName: name, oid: '41' }), { code: 'fixture_parent_identity_changed' });
  assert.equal(f.calls.some(([action]) => action === 'reap'), false);
});

test('release requires independently observed absence and repeated verified release counts once', async () => {
  const f = fixture(); const name = await f.reserve(); await f.commit(name);
  await assert.rejects(f.dispatch('release', { databaseName: name, oid: '41' }), { code: 'fixture_parent_cleanup_incomplete' });
  f.databases.delete(name);
  await f.dispatch('release', { databaseName: name, oid: '41' }); await f.dispatch('release', { databaseName: name, oid: '41' });
  assert.deepEqual(await f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
    { reserved: 1, registered: 1, released: 1, reaped: 0, uncertain: 0 });
});

test('an absent registered database is clean after a lost release acknowledgment', async () => {
  const f = fixture(); const name = await f.reserve(); await f.commit(name); f.databases.delete(name);
  assert.deepEqual(await f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
    { reserved: 1, registered: 1, released: 1, reaped: 0, uncertain: 0 });
  assert.equal(f.calls.some(([action]) => action === 'reap'), false);
});

test('abandon never grants DROP authority and an existing uncommitted reservation is uncertainty', async () => {
  const f = fixture(); const unknown = await f.reserve(); await f.dispatch('abandon', { databaseName: unknown });
  f.databases.set(unknown, { oid: '51', owned: true, activeCount: 0 });
  const known = await f.reserve('template'); await f.commit(known, '52');
  await assert.rejects(f.registry.finishScope(f.scope.token, { workersQuiescent: true }), (error) => {
    assert.equal(error.code, 'fixture_parent_database_uncertain');
    assert.deepEqual(error.stats, { reserved: 2, registered: 1, released: 0, reaped: 1, uncertain: 1 }); return true;
  });
  assert.equal(f.databases.has(unknown), true); assert.equal(f.databases.has(known), false);
  assert.equal(f.calls.some(([action, name]) => action === 'reap' && name === unknown), false);
  assert.equal(f.registry.authenticate(f.scope.token), false);
  assert.throws(() => f.registry.beginScope(), { code: 'fixture_parent_scope_active' });
});

test('unused absent reservations are not inferred as created resources', async () => {
  const f = fixture(); const name = await f.reserve(); await f.dispatch('abandon', { databaseName: name });
  assert.deepEqual(await f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
    { reserved: 1, registered: 0, released: 0, reaped: 0, uncertain: 0 });
  assert.equal(f.calls.some(([action]) => action === 'reap'), false);
});

test('closing admission blocks queued reserves before any name is published', async () => {
  const entered = createFixtureGate(); const resume = createFixtureGate();
  const f = fixture({ onInspect: async () => { entered.release(); await resume.promise; } });
  const first = f.reserve(); first.catch(() => {});
  await entered.promise; const second = f.reserve(); second.catch(() => {});
  f.registry.closeAdmission(f.scope.token); resume.release();
  await assert.rejects(first, { code: 'fixture_parent_scope_closed' });
  await assert.rejects(second, { code: 'fixture_parent_scope_closed' });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(await f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
    { reserved: 0, registered: 0, released: 0, reaped: 0, uncertain: 0 });
});

test('finish revokes immediately, drains accepted registration and serializes cleanup before a new scope', async () => {
  const entered = createFixtureGate(); const resume = createFixtureGate(); let hold = false;
  const f = fixture({ onInspect: async () => { if (hold) { entered.release(); await resume.promise; } } });
  const name = await f.reserve(); hold = true;
  const committing = f.commit(name); committing.catch(() => {}); await entered.promise;
  const finishing = f.registry.finishScope(f.scope.token, { workersQuiescent: true });
  assert.equal(f.registry.authenticate(f.scope.token), false);
  assert.throws(() => f.registry.beginScope(), { code: 'fixture_parent_scope_active' });
  await assert.rejects(f.dispatch('reserve', { kind: 'scenario' }), { code: 'fixture_parent_authentication_failed' });
  hold = false; resume.release(); await committing;
  const result = await finishing;
  assert.deepEqual(result, { reserved: 1, registered: 1, released: 0, reaped: 1, uncertain: 0 });
  assert.equal(f.maxActive(), 1);
  assert.deepEqual(await f.registry.finishScope(f.scope.token, { workersQuiescent: true }), result);
  const next = f.registry.beginScope(); assert.notEqual(next.token, f.scope.token);
  assert.equal(f.registry.authenticate(f.scope.token), false); assert.equal(f.registry.authenticate(next.token), true);
});

test('unknown worker liveness cannot authorize reaping or a next scope', async () => {
  const f = fixture(); const name = await f.reserve(); await f.commit(name); const calls = f.calls.length;
  await assert.rejects(f.registry.finishScope(f.scope.token, { workersQuiescent: false }), { code: 'fixture_parent_workers_not_quiescent' });
  assert.equal(f.calls.length, calls); assert.equal(f.databases.has(name), true);
  assert.equal(f.registry.authenticate(f.scope.token), false); assert.throws(() => f.registry.beginScope(), { code: 'fixture_parent_scope_active' });
  assert.equal((await f.registry.finishScope(f.scope.token, { workersQuiescent: true })).reaped, 1);
});

test('cleanup continues later entries and preserves the first fixed error with opaque counts', async () => {
  const firstError = parentPostgresError('fixture_parent_store_failed'); let broken;
  const f = fixture({ onReap: (name) => { if (name === broken) throw firstError; } });
  broken = await f.reserve(); await f.commit(broken); const next = await f.reserve(); await f.commit(next, '42');
  await assert.rejects(f.registry.finishScope(f.scope.token, { workersQuiescent: true }), (error) => {
    assert.equal(error, firstError); assert.deepEqual(error.stats, { reserved: 2, registered: 2, released: 0, reaped: 1, uncertain: 1 });
    assert.doesNotMatch(JSON.stringify(error.stats), /case_|token|oid/u); return true;
  });
  assert.equal(f.databases.has(broken), true); assert.equal(f.databases.has(next), false);
});

test('caller mutation cannot redirect a queued record and PIDs remain observations only', async () => {
  const entered = createFixtureGate(); const resume = createFixtureGate(); let holding = true; const kinds = [];
  const f = fixture({ nameFactory: ({ kind }) => { kinds.push(kind); return `case_${kinds.length}`; },
    onInspect: async () => { if (holding) { entered.release(); await resume.promise; } } });
  const first = f.reserve('scenario', 111); await entered.promise;
  const mutable = record('reserve', { kind: 'scenario' }, 222);
  const queued = f.registry.dispatch(f.scope.token, mutable); mutable.kind = 'template'; mutable.pid = 999;
  holding = false; resume.release(); await first; await queued;
  assert.deepEqual(kinds, ['scenario', 'scenario']); assert.deepEqual(f.registry.workerPids(f.scope.token), [111, 222]);
  await f.registry.finishScope(f.scope.token, { workersQuiescent: true });
});

test('malformed finish options cannot expose arbitrary errors or claim worker quiescence', async () => {
  const f = fixture();
  const options = {};
  Object.defineProperty(options, 'workersQuiescent', { enumerable: true, get() { throw new Error('private-token-and-DSN-canary'); } });
  await assert.rejects(f.registry.finishScope(f.scope.token, options), (error) => {
    assert.equal(error.code, 'fixture_parent_record_invalid');
    assert.doesNotMatch(error.message, /private-token|DSN/u); return true;
  });
  assert.equal(f.calls.length, 0); assert.equal(f.registry.authenticate(f.scope.token), false);
  assert.throws(() => f.registry.beginScope(), { code: 'fixture_parent_scope_active' });
});
