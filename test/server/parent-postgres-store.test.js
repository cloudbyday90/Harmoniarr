/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createParentPostgresStore } from '../../testing/integration/parent-postgres-store.js';

function fixture({ owned = true, oid = '41', activeCount = 0, leaveDropped = false, afterAlter = null, afterTerminate = null } = {}) {
  const databases = new Map([['owned_case', { oid, owned, active_count: activeCount }],
    ['sibling', { oid: '99', owned: false, active_count: 1 }]]);
  const calls = []; let activeQueries = 0; let maxActive = 0;
  const adminClient = { async query(sql, values) {
    activeQueries += 1; maxActive = Math.max(maxActive, activeQueries); calls.push({ sql, values });
    try {
      await Promise.resolve();
      if (sql.includes('FROM pg_database d')) return { rows: databases.has(values[0]) ? [{ ...databases.get(values[0]) }] : [] };
      if (sql.startsWith('ALTER DATABASE')) { await afterAlter?.(databases); return { rows: [] }; }
      if (sql.includes('pg_terminate_backend')) {
        assert.deepEqual(values, ['41']);
        assert.match(sql, /datid=\$1::oid/u); assert.doesNotMatch(sql, /datname/u);
        if (afterTerminate) await afterTerminate(databases); else databases.get('owned_case').active_count = 0;
        return { rows: [{ pg_terminate_backend: true }] };
      }
      if (sql.startsWith('DROP DATABASE')) { if (!leaveDropped) databases.delete('owned_case'); return { rows: [] }; }
      throw new Error('Unexpected controlled query');
    } finally { activeQueries -= 1; }
  } };
  return { store: createParentPostgresStore({ adminClient }), databases, calls, maxActive: () => maxActive };
}

test('inspection returns only typed current identity, role and activity or verified absence', async () => {
  const f = fixture();
  assert.deepEqual(await f.store.inspect('owned_case'), { oid: '41', owned: true, activeCount: 0 });
  assert.deepEqual(await f.store.inspect('sibling'), { oid: '99', owned: false, activeCount: 1 });
  assert.equal(await f.store.inspect('absent'), null);
});

test('invalid names and OIDs refuse before maintenance SQL', async () => {
  for (const name of ['', null, 'UPPER', 'name;drop', 'x'.repeat(64)]) {
    const f = fixture();
    await assert.rejects(f.store.inspect(name), { code: 'fixture_parent_invalid' });
    await assert.rejects(f.store.reap(name, '41'), { code: 'fixture_parent_invalid' });
    assert.equal(f.calls.length, 0);
  }
  for (const oid of ['0', '041', '4294967296', 41, '41;drop']) {
    const f = fixture(); await assert.rejects(f.store.reap('owned_case', oid), { code: 'fixture_parent_invalid' });
    assert.equal(f.calls.length, 0);
  }
});

test('reaping fences admission, verifies actual OID-targeted drain, drops and verifies absence without touching siblings', async () => {
  const f = fixture({ activeCount: 2 }); const sibling = { ...f.databases.get('sibling') };
  await f.store.reap('owned_case', '41');
  assert.equal(f.databases.has('owned_case'), false); assert.deepEqual(f.databases.get('sibling'), sibling);
  const statements = f.calls.map(({ sql }) => sql);
  assert.ok(statements.findIndex((sql) => sql.startsWith('ALTER')) < statements.findIndex((sql) => sql.includes('pg_terminate_backend')));
  assert.ok(statements.findIndex((sql) => sql.includes('pg_terminate_backend')) < statements.findIndex((sql) => sql.startsWith('DROP')));
  assert.equal(f.maxActive(), 1);
});

test('foreign ownership and a different OID never authorize destructive maintenance', async () => {
  for (const options of [{ owned: false }, { oid: '42' }]) {
    const f = fixture(options); const before = { ...f.databases.get('owned_case') };
    await assert.rejects(f.store.reap('owned_case', '41'), { code: 'fixture_parent_identity_changed' });
    assert.deepEqual(f.databases.get('owned_case'), before);
    assert.equal(f.calls.some(({ sql }) => /ALTER|DROP|pg_terminate_backend/u.test(sql)), false);
  }
  const f = fixture(); await f.store.reap('absent', '41');
  assert.equal(f.calls.some(({ sql }) => /ALTER|DROP|pg_terminate_backend/u.test(sql)), false);
});

test('a replacement observed after admission fencing stops before terminating or dropping its sessions', async () => {
  const f = fixture({ afterAlter: (databases) => databases.set('owned_case', { oid: '42', owned: true, active_count: 3 }) });
  await assert.rejects(f.store.reap('owned_case', '41'), { code: 'fixture_parent_identity_changed' });
  assert.equal(f.databases.get('owned_case').oid, '42');
  assert.equal(f.calls.some(({ sql }) => /DROP|pg_terminate_backend/u.test(sql)), false);
});

test('successful termination signalling cannot replace a fresh valid zero-session observation', async () => {
  const f = fixture({ activeCount: 1, afterTerminate: (databases) => { databases.get('owned_case').active_count = '0'; } });
  await assert.rejects(f.store.reap('owned_case', '41'), { code: 'fixture_parent_store_failed' });
  assert.equal(f.calls.some(({ sql }) => sql.startsWith('DROP')), false);
});

test('a successful DROP command with a remaining row is dirty cleanup', async () => {
  const f = fixture({ leaveDropped: true });
  await assert.rejects(f.store.reap('owned_case', '41'), { code: 'fixture_parent_cleanup_incomplete' });
});

test('malformed identity rows and raw driver failures cannot become absence or leak connection details', async () => {
  for (const row of [{ oid: '41', owned: true, active_count: '0' }, { oid: '0', owned: true, active_count: 0 },
    { oid: '41', owned: 1, active_count: 0 }, { oid: '41', owned: true, active_count: -1 }]) {
    const store = createParentPostgresStore({ adminClient: { query: async () => ({ rows: [row] }) } });
    await assert.rejects(store.inspect('owned_case'), { code: 'fixture_parent_store_failed' });
  }
  const secret = 'postgres://private-token/password SELECT raw';
  const store = createParentPostgresStore({ adminClient: { query: async () => { throw new Error(secret); } } });
  await assert.rejects(store.inspect('owned_case'), (error) => {
    assert.equal(error.code, 'fixture_parent_store_failed'); assert.equal(error.cause, undefined);
    assert.doesNotMatch(error.message, /private-token|password|SELECT/u); return true;
  });
});
