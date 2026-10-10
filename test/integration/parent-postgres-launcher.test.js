/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';

import { buildPostgresAdminConnectionConfig } from '../../testing/postgres-temporary-database.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createOwnedPostgresServer } from '../../testing/integration/owned-postgres-server.js';
import { terminateOwnedProcessTree } from '../../testing/integration/owned-process-tree.js';
import { createParentPostgresControlServer } from '../../testing/integration/parent-postgres-control-server.js';
import { parentPostgresEnvironmentKeys } from '../../testing/integration/parent-postgres-client.js';
import { createParentPostgresRegistry } from '../../testing/integration/parent-postgres-registry.js';
import { createParentPostgresStore } from '../../testing/integration/parent-postgres-store.js';
import { runPostgresTestFile } from '../../testing/integration/postgres-file-process.js';
import { postgresWorkersAreQuiescent } from '../../testing/integration/postgres-test-launcher.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
const fixtureFile = resolve('testing/integration/fixtures/parent-postgres-worker.js');
let owner;
let admin;
let unavailable;

function quotedName(name) {
  assert.match(name, /^[a-z][a-z0-9_]{0,62}$/u);
  return `"${name}"`;
}

async function ownCanaryDatabase(t, name = `harmoniarr_sibling_${randomUUID().replaceAll('-', '')}`) {
  await admin.query(`CREATE DATABASE ${quotedName(name)} TEMPLATE template0`);
  const store = createParentPostgresStore({ adminClient: admin });
  const identity = await store.inspect(name);
  assert.equal(identity.owned, true);
  const pool = new pg.Pool({ ...buildPostgresAdminConnectionConfig(owner.env), database: name,
    max: 1, connectionTimeoutMillis: config.poolConnectionTimeoutMs });
  pool.on('error', () => {});
  t.after(async () => {
    try { await pool.end(); }
    finally { await store.reap(name, identity.oid); }
  });
  await pool.query('CREATE TABLE controlled_parent_canary(value integer NOT NULL)');
  await pool.query('INSERT INTO controlled_parent_canary(value) VALUES (17)');
  return { name, identity,
    async assertUnchanged() {
      const current = await store.inspect(name);
      assert.equal(current.oid, identity.oid); assert.equal(current.owned, true);
      assert.deepEqual((await pool.query('SELECT value FROM controlled_parent_canary')).rows, [{ value: 17 }]);
      assert.equal((await admin.query('SELECT datallowconn FROM pg_database WHERE datname=$1', [name])).rows[0].datallowconn, true);
    },
  };
}

async function scopeFixture(t) {
  const store = createParentPostgresStore({ adminClient: admin });
  const registry = createParentPostgresRegistry({ store });
  const observations = [];
  const control = await createParentPostgresControlServer({ registry: {
    authenticate: registry.authenticate,
    async dispatch(token, record) {
      const result = await registry.dispatch(token, record);
      observations.push({ action: record.action, pid: record.pid, databaseName: result?.databaseName ?? record.databaseName,
        oid: result?.oid ?? record.oid });
      return result;
    },
  } });
  t.after(() => control.close());
  const scope = registry.beginScope();
  const env = { ...process.env, ...owner.env,
    [parentPostgresEnvironmentKeys.mode]: 'parent',
    [parentPostgresEnvironmentKeys.endpoint]: control.endpoint,
    [parentPostgresEnvironmentKeys.token]: scope.token };
  const output = { stdout: '', stderr: '' };
  const streams = Object.fromEntries(Object.keys(output).map((key) => [key,
    new Writable({ write(chunk, encoding, callback) { output[key] += chunk.toString(); callback(); } })]));
  return { store, registry, scope, env, output, streams, observations };
}

async function exitWorker(f, mode = 'exit') {
  const result = await runPostgresTestFile({ file: fixtureFile, env: { ...f.env, HARMONIARR_PARENT_PG_FIXTURE_MODE: mode },
    ...f.streams, onCancel: () => f.registry.closeAdmission(f.scope.token) });
  assert.equal(result.exitCode, 1);
  assert.equal(postgresWorkersAreQuiescent(f.registry.workerPids(f.scope.token)), true);
  f.registry.closeAdmission(f.scope.token);
  assert.equal(f.output.stderr.includes(owner.env.PGPASSWORD), false);
  assert.equal(f.output.stderr.includes(f.scope.token), false);
  return result;
}

function skipIfUnavailable(t) {
  if (!unavailable) return false;
  t.skip(unavailable); return true;
}

suite('Parent-owned PostgreSQL subprocess recovery', () => {
  before(async () => {
    try {
      owner = await createOwnedPostgresServer({ config });
      admin = new pg.Client({ ...buildPostgresAdminConnectionConfig(owner.env), statement_timeout: 5000 });
      await admin.connect();
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => {
    try { await admin?.end(); }
    finally { await owner?.close(); }
  }, { timeout: config.suiteTeardownTimeoutMs });

  test('native worker exit after CREATE registration is reaped by matching identity while a connected sibling survives', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const sibling = await ownCanaryDatabase(t); const f = await scopeFixture(t);
    await exitWorker(f);
    const committed = f.observations.filter((record) => record.action === 'commit');
    assert.equal(committed.length, 1);
    assert.equal((await f.store.inspect(committed[0].databaseName)).oid, committed[0].oid);
    const canaryPool = new pg.Pool({ ...buildPostgresAdminConnectionConfig(owner.env), database: committed[0].databaseName });
    try { assert.deepEqual((await canaryPool.query('SELECT value FROM controlled_child_data')).rows, [{ value: 31 }]); }
    finally { await canaryPool.end(); }
    const result = await f.registry.finishScope(f.scope.token, { workersQuiescent: true });
    assert.equal(result.registered, 1); assert.equal(result.reaped, 1); assert.equal(result.uncertain, 0);
    assert.equal(await f.store.inspect(committed[0].databaseName), null);
    await sibling.assertUnchanged();
  });

  test('cancellation closes admission and terminates the actual native runner tree before registry recovery', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const sibling = await ownCanaryDatabase(t); const f = await scopeFixture(t);
    const entered = createFixtureGate(); const controller = new AbortController(); const primary = new Error('Controlled owned-runner cancellation');
    const heldResponses = new Set(); const order = []; let actualRoot; let terminationPid; let termination;
    const heldServer = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/held') { response.writeHead(404).end(); return; }
      heldResponses.add(response); response.once('close', () => heldResponses.delete(response)); entered.release();
    });
    await new Promise((accept, reject) => { heldServer.once('error', reject); heldServer.listen(0, '127.0.0.1', accept); });
    let pending;
    t.after(async () => {
      controller.abort(primary);
      for (const response of heldResponses) response.writeHead(200).end('released');
      if (pending) await pending.catch(() => {});
      heldServer.closeAllConnections();
      await new Promise((accept) => { heldServer.close(accept); });
    });
    pending = runPostgresTestFile({ file: fixtureFile, env: { ...f.env, HARMONIARR_PARENT_PG_FIXTURE_MODE: 'hold',
      HARMONIARR_PARENT_PG_FIXTURE_RELEASE_URL: `http://127.0.0.1:${heldServer.address().port}/held` }, ...f.streams,
      signal: controller.signal,
      spawnFn(...args) { actualRoot = spawn(...args); return actualRoot; },
      onCancel() { f.registry.closeAdmission(f.scope.token); order.push('admission closed'); },
      terminateFn(input) { terminationPid = input.child.pid; order.push('terminate'); return terminateOwnedProcessTree(input); },
      onTermination(result) { termination = result; order.push('termination observed'); },
    });
    pending.catch(() => {});
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    const workers = f.registry.workerPids(f.scope.token);
    assert.equal(workers.length, 1); assert.equal(workers.includes(actualRoot.pid), false);
    controller.abort(primary);
    await assert.rejects(pending, (error) => error === primary);
    assert.equal(terminationPid, actualRoot.pid);
    assert.equal(termination.quiescent, true); assert.equal(termination.code, null);
    assert.equal(typeof termination.outputDrained, 'boolean');
    assert.deepEqual(order, ['admission closed', 'terminate', 'termination observed']);
    assert.equal(postgresWorkersAreQuiescent(workers), true);
    const result = await f.registry.finishScope(f.scope.token, { workersQuiescent: true });
    assert.equal(result.registered, 1); assert.equal(result.reaped, 1); assert.equal(result.uncertain, 0);
    assert.equal(await f.store.inspect(f.observations.find((record) => record.action === 'commit').databaseName), null);
    await sibling.assertUnchanged();
  });

  test('an uncommitted reservation cannot authorize deleting independently created parent data', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const f = await scopeFixture(t); await exitWorker(f, 'reserve_only');
    assert.equal(f.observations.some((record) => record.action === 'commit'), false);
    const reserved = f.observations.find((record) => record.action === 'reserve').databaseName;
    const protectedDatabase = await ownCanaryDatabase(t, reserved);
    await assert.rejects(f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
      (error) => error.code === 'fixture_parent_database_uncertain' && error.stats.uncertain === 1 && error.stats.reaped === 0);
    await protectedDatabase.assertUnchanged();
  });

  test('replacement OID retains its independently owned data and connections when old scope cleanup refuses', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const f = await scopeFixture(t); await exitWorker(f);
    const committed = f.observations.find((record) => record.action === 'commit');
    await f.store.reap(committed.databaseName, committed.oid);
    const replacement = await ownCanaryDatabase(t, committed.databaseName);
    assert.notEqual(replacement.identity.oid, committed.oid);
    await assert.rejects(f.registry.finishScope(f.scope.token, { workersQuiescent: true }),
      (error) => error.code === 'fixture_parent_identity_changed' && error.stats.reaped === 0);
    await replacement.assertUnchanged();
  });
});
