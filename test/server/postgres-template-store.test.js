/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresTemplateStore, templateDatabaseProfile } from '../../testing/integration/postgres-template-store.js';

function database(overrides = {}) {
  return { oid: '41', connections_allowed: true, broadly_cloneable: false, owned_by_current_role: true,
    active_count: 0, server_version: '180001', encoding: 'UTF8', locale_provider: 'c',
    collation: 'C', ctype: 'C', locale: null, icu_rules: null, ...overrides };
}

function fixture({ entries = [['owned_source', database()]], leaveDropped = false, ignoreSeal = false } = {}) {
  const databases = new Map(entries);
  const calls = [];
  const collision = Object.assign(new Error('Controlled database collision'), { code: '42P04' });
  let nextOid = 100;
  const adminClient = { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('FROM pg_database d')) return { rows: databases.has(values[0]) ? [{ ...databases.get(values[0]) }] : [] };
    if (sql.includes('COUNT(*)::integer AS active_count')) return { rows: [{ active_count: 0 }] };
    const create = /^CREATE DATABASE "([a-z0-9_]+)" TEMPLATE (?:template0|"([a-z0-9_]+)") ALLOW_CONNECTIONS true$/u.exec(sql);
    if (create) {
      if (databases.has(create[1])) throw collision;
      const source = create[2] ? databases.get(create[2]) : database();
      assert.ok(source);
      databases.set(create[1], { ...source, oid: String(++nextOid), connections_allowed: true, active_count: 0 });
      return { rows: [] };
    }
    const seal = /^ALTER DATABASE "([a-z0-9_]+)" ALLOW_CONNECTIONS false$/u.exec(sql);
    if (seal) {
      if (!ignoreSeal) databases.get(seal[1]).connections_allowed = false;
      return { rows: [] };
    }
    const drop = /^DROP DATABASE "([a-z0-9_]+)"$/u.exec(sql);
    if (drop) {
      if (!leaveDropped) databases.delete(drop[1]);
      return { rows: [] };
    }
    throw new Error('Unexpected controlled maintenance query');
  } };
  return { store: createPostgresTemplateStore({ adminClient }), databases, calls, collision };
}

test('store creates private sources and connection-enabled clones without broadening source identity', async () => {
  const f = fixture({ entries: [] });
  await f.store.create('owned_source');
  const source = await f.store.inspect('owned_source');
  await f.store.seal('owned_source', source.oid);
  await f.store.createClone('owned_case', 'owned_source');
  assert.equal(f.databases.get('owned_source').connections_allowed, false);
  assert.equal(f.databases.get('owned_source').broadly_cloneable, false);
  assert.equal(f.databases.get('owned_source').oid, source.oid);
  assert.equal(f.databases.get('owned_case').connections_allowed, true);
  assert.notEqual(f.databases.get('owned_case').oid, source.oid);
});

test('CREATE collision preserves the original database and native failure identity', async () => {
  const f = fixture(); const original = { ...f.databases.get('owned_source') };
  await assert.rejects(f.store.create('owned_source'), (error) => error === f.collision);
  assert.deepEqual(f.databases.get('owned_source'), original);
  assert.equal(f.calls.some(({ sql }) => /DROP|terminate/u.test(sql)), false);
});

test('invalid names are refused before every maintenance query boundary', async () => {
  for (const invalid of ['outside source', 'owned_source";DROP', 'A_source', 'x'.repeat(64), '', null, {}]) {
    for (const method of ['inspect', 'create', 'seal', 'assertSealed', 'dropOwned']) {
      const f = fixture();
      await assert.rejects(Promise.resolve().then(() => f.store[method](invalid, '41')),
        (error) => error.code === 'fixture_template_invalid');
      assert.equal(f.calls.length, 0);
    }
    for (const args of [[invalid, 'owned_source'], ['owned_case', invalid]]) {
      const f = fixture();
      await assert.rejects(Promise.resolve().then(() => f.store.createClone(...args)),
        (error) => error.code === 'fixture_template_invalid');
      assert.equal(f.calls.length, 0);
    }
  }
});

test('inspection rejects malformed or foreign ownership facts and handles an absent source', async () => {
  assert.equal(await fixture({ entries: [] }).store.inspect('missing_source'), null);
  for (const patch of [
    { oid: '0' }, { oid: '4294967296' }, { owned_by_current_role: false },
    { active_count: -1 }, { active_count: '0' }, { connections_allowed: null }, { broadly_cloneable: 0 },
  ]) {
    const f = fixture({ entries: [['owned_source', database(patch)]] });
    await assert.rejects(f.store.inspect('owned_source'), (error) => error.code === 'fixture_template_invalid');
    assert.equal(f.calls.some(({ sql }) => /ALTER|DROP|terminate/u.test(sql)), false);
  }
});

test('fingerprint profile omits identity and exposes only database compatibility fields', () => {
  assert.deepEqual(templateDatabaseProfile(database({ databaseName: 'private-name-canary', credentials: 'private-secret-canary' })),
    { serverVersion: '180001', encoding: 'UTF8', localeProvider: 'c', collation: 'C', ctype: 'C', locale: null, icuRules: null });
});

test('a replacement source is never altered or dropped using the older observed OID', async () => {
  for (const method of ['seal', 'assertSealed', 'dropOwned']) {
    const f = fixture({ entries: [['owned_source', database({ oid: '42' })]] });
    const replacement = { ...f.databases.get('owned_source') };
    await assert.rejects(f.store[method]('owned_source', '41'), (error) => error.code === 'fixture_template_identity_changed');
    assert.deepEqual(f.databases.get('owned_source'), replacement);
    assert.equal(f.calls.some(({ sql }) => /ALTER|DROP|terminate/u.test(sql)), false);
  }
});

test('sealing refuses an active source, unchanged connection allowance or broad cloning authority', async () => {
  for (const options of [
    { entries: [['owned_source', database({ active_count: 1 })]] },
    { ignoreSeal: true },
    { entries: [['owned_source', database({ broadly_cloneable: true })]] },
  ]) {
    const f = fixture(options);
    await assert.rejects(f.store.seal('owned_source', '41'), (error) => error.code === 'fixture_template_not_quiescent');
    assert.equal(f.databases.has('owned_source'), true);
  }
});

test('clone admission rechecks all sealed-source facts without modifying the source', async () => {
  for (const patch of [{ active_count: 1 }, { connections_allowed: true }, { broadly_cloneable: true }]) {
    const f = fixture({ entries: [['owned_source', database({ connections_allowed: false, ...patch })]] });
    await assert.rejects(f.store.assertSealed('owned_source', '41'), (error) => error.code === 'fixture_template_not_quiescent');
    assert.equal(f.calls.some(({ sql }) => /ALTER|DROP|CREATE|terminate/u.test(sql)), false);
  }
  const f = fixture({ entries: [['owned_source', database({ connections_allowed: false })]] });
  assert.equal((await f.store.assertSealed('owned_source', '41')).oid, '41');
});

test('owned drop verifies drained absence and refuses to report a retained database as cleaned', async () => {
  const f = fixture();
  await f.store.dropOwned('owned_source', '41');
  assert.equal(f.databases.has('owned_source'), false);
  const retained = fixture({ leaveDropped: true });
  await assert.rejects(retained.store.dropOwned('owned_source', '41'), (error) => error.code === 'fixture_template_cleanup_incomplete');
  assert.equal(retained.databases.has('owned_source'), true);
});

test('absent source cleanup does not perform a destructive query', async () => {
  const f = fixture({ entries: [] });
  await f.store.dropOwned('missing_source', '41');
  assert.equal(f.calls.some(({ sql }) => /DROP|terminate/u.test(sql)), false);
});

test('metadata inspection errors preserve their source identity instead of authorizing cleanup', async () => {
  const primary = new Error('Controlled maintenance read failure');
  const store = createPostgresTemplateStore({ adminClient: { query: async () => { throw primary; } } });
  await assert.rejects(store.dropOwned('owned_source', '41'), (error) => error === primary);
});
