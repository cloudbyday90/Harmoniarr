/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { loadMigrationTemplateInputs } from '../../testing/integration/migration-template-inputs.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';

const validInputs = await loadMigrationTemplateInputs();
const sourceName = 'controlled_template_source';

function database(oid) {
  return { oid: String(oid), connections_allowed: true, broadly_cloneable: false, owned_by_current_role: true,
    active_count: 0, server_version: '180001', encoding: 'UTF8', locale_provider: 'c',
    collation: 'C', ctype: 'C', locale: null, icu_rules: null };
}

function fixture({ prepare = null, inspectFailure = null, dropFailure = null, poolEndFailure = null } = {}) {
  const databases = new Map(); const events = []; const records = []; const pools = []; const admins = [];
  let nextOid = 40; let preparationCount = 0; let currentInputs = validInputs;
  const adminClientFactory = () => {
    const id = admins.length;
    const client = {
      connect: async () => { events.push({ kind: 'connect', id }); },
      end: async () => { events.push({ kind: 'admin_end', id }); },
      async query(sql, values) {
        events.push({ kind: 'query', id, sql, values });
        if (sql.includes('FROM pg_database d')) {
          if (inspectFailure && values[0] === sourceName) throw inspectFailure;
          return { rows: databases.has(values[0]) ? [{ ...databases.get(values[0]) }] : [] };
        }
        if (sql.includes('COUNT(*)::integer AS active_count')) {
          // A deliberate external session has stopped by the cleanup checkpoint.
          if (databases.has(values[0])) databases.get(values[0]).active_count = 0;
          return { rows: [{ active_count: 0 }] };
        }
        const create = /^CREATE DATABASE "([a-z0-9_]+)" TEMPLATE (?:template0|"([a-z0-9_]+)") ALLOW_CONNECTIONS true$/u.exec(sql);
        if (create) {
          if (databases.has(create[1])) throw Object.assign(new Error('Controlled collision'), { code: '42P04' });
          const inherited = create[2] ? databases.get(create[2]) : database(++nextOid);
          assert.ok(inherited);
          databases.set(create[1], { ...inherited, oid: String(++nextOid), connections_allowed: true, active_count: 0 });
          return { rows: [] };
        }
        const seal = /^ALTER DATABASE "([a-z0-9_]+)" ALLOW_CONNECTIONS false$/u.exec(sql);
        if (seal) { databases.get(seal[1]).connections_allowed = false; return { rows: [] }; }
        const drop = /^DROP DATABASE(?: IF EXISTS)? "([a-z0-9_]+)"$/u.exec(sql);
        if (drop) {
          if (dropFailure) throw dropFailure;
          databases.delete(drop[1]); return { rows: [] };
        }
        throw new Error('Unexpected controlled query');
      },
    };
    admins.push(client); return client;
  };
  const createPool = (config) => {
    const pool = { config, on: () => {}, async end() {
      events.push({ kind: 'pool_end', name: config.database });
      if (poolEndFailure) throw poolEndFailure;
    } };
    pools.push(pool); events.push({ kind: 'pool_create', name: config.database }); return pool;
  };
  const input = {
    env: { PGHOST: 'private-host-canary', PGUSER: 'private-user-canary', PGPASSWORD: 'private-password-canary' },
    databaseName: sourceName, adminClientFactory, createPool,
    phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
    loadInputsFn: async () => currentInputs,
    prepareDatabaseFn: async (context) => {
      preparationCount += 1; events.push({ kind: 'prepare' });
      assert.equal(context.getPoolFn(), pools[0]); assert.equal(context.inputs, currentInputs);
      if (prepare) await prepare({ ...context, databases });
    },
  };
  return { input, databases, events, records, pools, admins,
    preparationCount: () => preparationCount,
    driftInputs: () => { currentInputs = { ...validInputs, sourceFingerprint: validInputs.sourceFingerprint === 'f'.repeat(64)
      ? 'e'.repeat(64) : 'f'.repeat(64) }; },
  };
}

function destructiveSourceQueries(f) {
  return f.events.filter((event) => event.kind === 'query'
    && /DROP DATABASE|pg_terminate_backend/u.test(event.sql)
    && (event.sql.includes(`"${sourceName}"`) || event.values?.[0] === sourceName));
}

test('one preparation publishes only clone contexts and closes the private pool before sealing', async () => {
  const f = fixture(); const owner = await createPreparedPostgresTemplate(f.input);
  try {
    assert.deepEqual(Object.keys(owner).sort(), ['cleanup', 'runIsolatedDatabase', 'schemaMode']);
    const endIndex = f.events.findIndex((event) => event.kind === 'pool_end');
    const sealIndex = f.events.findIndex((event) => event.kind === 'query' && /^ALTER DATABASE/u.test(event.sql));
    assert.equal(endIndex >= 0 && endIndex < sealIndex, true);
    const contexts = [];
    for (let i = 0; i < 2; i += 1) await owner.runIsolatedDatabase(async (context) => { contexts.push(context); });
    assert.equal(f.preparationCount(), 1);
    assert.equal(new Set(contexts.map((context) => context.databaseName)).size, 2);
    for (const context of contexts) {
      assert.equal(context.schemaMode, 'migration_template');
      assert.notEqual(context.databaseName, sourceName);
      assert.notEqual(context.getPoolFn(), f.pools[0]);
      assert.equal(Object.hasOwn(context, 'sourcePool'), false);
    }
    assert.equal(f.databases.size, 1);
  } finally { await owner.cleanup(); }
  assert.equal(f.databases.size, 0);
  assert.equal(JSON.stringify(f.records).includes('private-'), false);
  assert.equal(JSON.stringify(f.records).includes(sourceName), false);
});

test('preparation failure never publishes a source and preserves its identity through secondary cleanup failure', async () => {
  const primary = new Error('Controlled preparation failure'); const secondary = new Error('Controlled pool cleanup failure');
  const f = fixture({ prepare: async () => { throw primary; }, poolEndFailure: secondary });
  await assert.rejects(createPreparedPostgresTemplate(f.input), (error) => error === primary);
  assert.equal(f.databases.size, 0);
  assert.equal(f.events.some((event) => event.kind === 'query' && /^ALTER DATABASE/u.test(event.sql)), false);
  assert.equal(f.records.find((record) => record.phase === 'template_prepare').outcome, 'failed');
  assert.equal(f.records.find((record) => record.phase === 'pool_close').outcome, 'failed');
  assert.equal(f.events.at(-1).kind, 'admin_end');
});

test('non-quiescent source preparation refuses publication and still cleans its acknowledged source', async () => {
  const f = fixture({ prepare: async ({ databases }) => { databases.get(sourceName).active_count = 1; } });
  await assert.rejects(createPreparedPostgresTemplate(f.input), (error) => error.code === 'fixture_template_not_quiescent');
  assert.equal(f.databases.size, 0);
  assert.equal(f.records.find((record) => record.phase === 'template_seal').outcome, 'failed');
  assert.equal(f.events.at(-1).kind, 'admin_end');
});

test('CREATE collision preserves an unacknowledged pre-existing source without destructive cleanup', async () => {
  const f = fixture(); const sibling = database('78');
  f.databases.set(sourceName, sibling);
  await assert.rejects(createPreparedPostgresTemplate(f.input), (error) => error.code === '42P04');
  assert.equal(f.databases.get(sourceName), sibling);
  assert.deepEqual(destructiveSourceQueries(f), []);
  assert.equal(f.pools.length, 0); assert.equal(f.preparationCount(), 0);
});

test('changed preparation inputs refuse source publication after the await rather than rebuilding silently', async () => {
  let f;
  f = fixture({ prepare: async () => { f.driftInputs(); } });
  await assert.rejects(createPreparedPostgresTemplate(f.input), (error) => error.code === 'fixture_template_fingerprint_changed');
  assert.equal(f.preparationCount(), 1); assert.equal(f.databases.size, 0);
});

test('changed fingerprint at clone admission creates neither pool nor database and never invokes the scenario', async () => {
  const f = fixture(); const owner = await createPreparedPostgresTemplate(f.input);
  try {
    f.driftInputs(); let invoked = false;
    await assert.rejects(owner.runIsolatedDatabase(async () => { invoked = true; }),
      (error) => error.code === 'fixture_template_fingerprint_changed');
    assert.equal(invoked, false); assert.equal(f.pools.length, 1); assert.equal(f.databases.size, 1);
    assert.equal(f.preparationCount(), 1);
  } finally { await owner.cleanup(); }
});

test('cleanup closes admission and waits for work registered before the initial creation await', async () => {
  const f = fixture(); const entered = createFixtureGate(); const resume = createFixtureGate();
  f.input.withTemporaryPostgresDatabaseFn = async (input) => {
    entered.release(); await resume.promise;
    return input.run({ getPoolFn: () => ({ clone: true }), databaseName: 'controlled_case' });
  };
  const owner = await createPreparedPostgresTemplate(f.input);
  let cleaned = false;
  const operation = owner.runIsolatedDatabase(async () => 'case completed');
  const cleanup = owner.cleanup().then(() => { cleaned = true; });
  try {
    await entered.promise;
    assert.equal(cleaned, false); assert.equal(f.databases.has(sourceName), true);
    await assert.rejects(owner.runIsolatedDatabase(async () => assert.fail('closed owner invoked a scenario')),
      (error) => error.code === 'fixture_template_closed');
    assert.equal(destructiveSourceQueries(f).length, 0);
  } finally { resume.release(); await operation; await cleanup; }
  assert.equal(cleaned, true); assert.equal(f.databases.size, 0);
  assert.equal(owner.cleanup(), owner.cleanup());
});

test('pre-aborted construction and case admission preserve the exact reason before resource creation', async () => {
  for (const reason of [new Error('Controlled cancellation'), null]) {
    const f = fixture(); const controller = new AbortController(); controller.abort(reason);
    await assert.rejects(createPreparedPostgresTemplate({ ...f.input, signal: controller.signal }), (error) => error === reason);
    assert.equal(f.admins.length, 0); assert.equal(f.events.length, 0);
    const owner = await createPreparedPostgresTemplate(f.input);
    try {
      let invoked = false;
      await assert.rejects(owner.runIsolatedDatabase(async () => { invoked = true; }, { signal: controller.signal }),
        (error) => error === reason);
      assert.equal(invoked, false); assert.equal(f.pools.length, 1); assert.equal(f.admins.length, 1);
    } finally { await owner.cleanup(); }
  }
});

test('cancellation during asynchronous pool construction prevents preparation and cleans the constructed pool and source', async (t) => {
  const f = fixture(); const entered = createFixtureGate(); const resume = createFixtureGate();
  const controller = new AbortController(); const reason = new Error('Controlled pool construction cancellation');
  const originalFactory = f.input.createPool;
  f.input.createPool = async (databaseConfig) => {
    const pool = originalFactory(databaseConfig);
    entered.release(); await resume.promise;
    return pool;
  };
  const creation = createPreparedPostgresTemplate({ ...f.input, signal: controller.signal });
  creation.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: creation, signal: t.signal });
    controller.abort(reason); resume.release();
    await assert.rejects(creation, (error) => error === reason);
    assert.equal(f.preparationCount(), 0);
    assert.equal(f.pools.length, 1);
    assert.equal(f.events.some((event) => event.kind === 'pool_end' && event.name === sourceName), true);
    assert.equal(f.databases.size, 0);
    assert.equal(f.records.some((record) => record.phase === 'template_prepare'), false);
    assert.equal(f.events.at(-1).kind, 'admin_end');
  } finally {
    resume.release(); await creation.catch(() => {});
  }
});

test('caller environment mutation after preparation cannot redirect clone pools from the captured endpoint and role', async () => {
  const f = fixture(); const originalEnv = { ...f.input.env };
  const owner = await createPreparedPostgresTemplate(f.input);
  try {
    f.input.env.PGHOST = 'changed-host-canary';
    f.input.env.PGUSER = 'changed-role-canary';
    f.input.env.PGPASSWORD = 'changed-password-canary';
    await owner.runIsolatedDatabase(async ({ databaseConfig, getPoolFn }) => {
      assert.equal(databaseConfig.host, originalEnv.PGHOST);
      assert.equal(databaseConfig.user, originalEnv.PGUSER);
      assert.equal(databaseConfig.password, originalEnv.PGPASSWORD);
      const poolConfig = getPoolFn().config;
      assert.equal(poolConfig.host, originalEnv.PGHOST);
      assert.equal(poolConfig.user, originalEnv.PGUSER);
      assert.equal(poolConfig.password, originalEnv.PGPASSWORD);
    });
  } finally { await owner.cleanup(); }
});

test('clone failure keeps its original identity while strict successful cleanup failures remain failures', async () => {
  const primary = new Error('Controlled clone scenario failure'); const secondary = new Error('Controlled drop failure');
  const f = fixture({ dropFailure: secondary }); const owner = await createPreparedPostgresTemplate(f.input);
  await assert.rejects(owner.runIsolatedDatabase(async () => { throw primary; }), (error) => error === primary);
  await assert.rejects(owner.runIsolatedDatabase(async () => 'not a clean success'), (error) => error === secondary);
  await assert.rejects(owner.cleanup(), (error) => error === secondary);
  assert.equal(f.events.at(-1).kind, 'admin_end');
});

test('replacement source identity blocks clone admission and cleanup never deletes the replacement', async () => {
  const f = fixture(); const owner = await createPreparedPostgresTemplate(f.input);
  const replacement = database('99'); replacement.connections_allowed = false;
  f.databases.set(sourceName, replacement);
  let invoked = false;
  await assert.rejects(owner.runIsolatedDatabase(async () => { invoked = true; }), (error) => error.code === 'fixture_template_identity_changed');
  await assert.rejects(owner.cleanup(), (error) => error.code === 'fixture_template_identity_changed');
  assert.equal(invoked, false); assert.equal(f.databases.get(sourceName), replacement);
  assert.equal(destructiveSourceQueries(f).length, 0);
  assert.equal(f.events.at(-1).kind, 'admin_end');
});

test('failed initial identity inspection cannot delete an unverified database and records incomplete cleanup', async () => {
  const primary = new Error('Controlled initial identity read failure');
  const f = fixture({ inspectFailure: primary });
  await assert.rejects(createPreparedPostgresTemplate(f.input), (error) => error === primary);
  assert.equal(f.databases.has(sourceName), true);
  assert.equal(destructiveSourceQueries(f).length, 0);
  assert.equal(f.events.at(-1).kind, 'admin_end');
  assert.equal(f.records.some((record) => record.phase === 'template_drop' && record.outcome === 'failed'), true);
});
