/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { inspectDatabaseSchemaDrift } from '../../src/server/schema-drift-service.js';
import { formatSchemaDriftDiagnostics } from '../../src/server/schema-drift-report-policy.js';
import { withSchemaObservation } from '../../src/server/schema-observation-owner-service.js';
import { databasePreparationLockKey } from '../../src/server/database-preparation-lock-store.js';

const repoMigrations = await loadMigrationManifest();
const expected = JSON.parse(await readFile(new URL('../../src/server/schema-anchor-contract.json', import.meta.url)));
function fixture(options = {}) {
  const calls = [], releases = [], catalog = structuredClone(expected.anchors);
  let status = options.initialStatus ?? 'I', groupIndex = 0;
  if (options.mutate) options.mutate(catalog);
  const client = Object.assign(new EventEmitter(), { getTransactionStatus: () => status, async query(sql, values) {
    calls.push({ sql, values });
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT)\b/u);
    if (sql === 'ROLLBACK') {
      if (Object.hasOwn(options, 'rollbackFailure')) throw options.rollbackFailure;
      status = 'I'; return { command: options.rollbackCommand ?? 'ROLLBACK' };
    }
    if (sql.includes('pg_locks')) return { rows: [{ owned: options.inherited ?? false }] };
    if (sql === 'BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY') { if (options.beginFailure) throw options.beginFailure; status = 'T'; }
    if (sql.includes('pg_try_advisory')) { assert.deepEqual(values, databasePreparationLockKey); return { rows: [{ acquired: options.locked ?? true }] }; }
    if (sql.includes('AS present')) return { rows: [{ present: options.present ?? true }] };
    if (sql.includes('FROM public.schema_migrations')) {
      assert.deepEqual(values, [116]);
      if (Object.hasOwn(options, 'queryFailure')) throw options.queryFailure;
      return { rows: options.rows ?? repoMigrations.map(m => ({ filename: m.filename, migration_key: m.migrationKey, checksum: m.checksum, status: 'applied' })) };
    }
    if (sql.includes('current_setting')) return { rows: [{ version: 180006, search_path: 'public' }] };
    if (sql.includes('jsonb_to_recordset')) {
      const group = ['tables', 'columns', 'constraints', 'indexes', 'triggers'][groupIndex++];
      return { rows: JSON.parse(values[0]).map(({ key }) => ({ key, actual: catalog[group][key] ?? null })) };
    }
    return { rows: [] };
  }, release(discard) { releases.push(discard); if (Object.hasOwn(options, 'releaseFailure')) throw options.releaseFailure; } });
  const createConnectionFn = () => ({ client, connect: async () => {}, close: async ({ force }) => client.release(force || undefined) });
  return { client, calls, releases, createConnectionFn, run: () => inspectDatabaseSchemaDrift({ createConnectionFn }) };
}

test('schema drift diagnosis bounds ledger reads and owns a read-only, locally timed, shared preparation observation', async () => {
  const f = fixture(), report = await f.run(); assert.equal(report.current, true);
  assert.equal(report.lineage.state, 'current'); assert.equal(report.anchors.checkedCount, 164);
  assert.equal(f.calls[1].sql, 'BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
  assert.deepEqual(f.calls.slice(2, 6).map(row => row.sql), ["SET LOCAL lock_timeout='2s'", "SET LOCAL statement_timeout='5s'",
    "SET LOCAL idle_in_transaction_session_timeout='5s'", "SET LOCAL transaction_timeout='15s'"]);
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert.deepEqual(f.releases, [undefined]);
  assert.equal(f.client.listenerCount('error'), 0); assert.equal(f.client.listenerCount('end'), 0);
});

test('lineage and critical drift are independent and expose approved identities rather than raw database contents', async () => {
  const f = fixture({ mutate: a => {
    a.indexes['index.admin_recovery_runs_one_armed_idx'] = null;
    a.triggers['trigger.app_users.app_users_root_authority_admission'].functionDefinition = 'private unexpected SQL body';
  } });
  const report = await f.run(); assert.equal(report.lineage.state, 'current'); assert.equal(report.current, false);
  assert.deepEqual(report.anchors.missing, ['index.admin_recovery_runs_one_armed_idx']);
  assert.deepEqual(report.anchors.altered, ['trigger.app_users.app_users_root_authority_admission']);
  const output = formatSchemaDriftDiagnostics(report);
  assert.match(output, /Schema diagnostics: attention/u); assert.match(output, /Migration lineage: current/u);
  assert.doesNotMatch(JSON.stringify(report) + output, /private|functionDefinition|CREATE|SELECT/u);
  const lineage = fixture({ rows: [{ filename: 'private filename', migration_key: 'private key', checksum: 'private checksum', status: 'failed' }] });
  const result = await lineage.run(); assert.equal(result.lineage.state, 'not_current'); assert.equal(result.anchors.state, 'current');
  assert.doesNotMatch(JSON.stringify(result), /private/u);
});

test('missing and excessive ledger rows are observation results without repair or misleading full counts', async () => {
  const missing = fixture({ present: false }), report = await missing.run();
  assert.equal(report.current, false); assert.equal(report.lineage.state, 'unavailable');
  assert.equal(missing.calls.some(row => row.sql.includes('FROM public.schema_migrations')), false);
  const excessive = fixture({ rows: Array.from({ length: 116 }, () => ({ filename: 'private', status: 'applied' })) });
  const result = await excessive.run(); assert.equal(result.lineage.reason, 'row_limit_exceeded');
  assert.equal(Object.hasOwn(result.lineage, 'appliedCount'), false);
});

test('busy preparation rolls back without reading ledger or anchor facts and inherited or dirty clients are discarded', async () => {
  const busy = fixture({ locked: false }); await assert.rejects(busy.run(), { code: 'schema_observation_busy' });
  assert.equal(busy.calls.some(row => row.sql.includes('AS present')), false); assert.equal(busy.calls.at(-1).sql, 'ROLLBACK');
  for (const options of [{ inherited: true }, { initialStatus: 'T' }]) {
    const f = fixture(options); await assert.rejects(f.run(), { code: 'schema_diagnostics_unavailable' });
    assert.deepEqual(f.releases, [true]); assert.equal(f.calls.some(row => row.sql.startsWith('BEGIN')), false);
  }
});

test('original Error/null survives failed rollback/release; successful work requires acknowledged rollback and visible cleanup', async () => {
  for (const original of [new Error('private original'), null]) for (const secondary of [new Error('private cleanup'), null]) {
    const f = fixture({ rollbackFailure: secondary, releaseFailure: secondary });
    await assert.rejects(withSchemaObservation({ createConnectionFn: f.createConnectionFn }, async () => { throw original; }), error => error === original);
    assert.deepEqual(f.releases, [true]);
  }
  for (const options of [{ rollbackFailure: null }, { rollbackCommand: 'COMMIT' }, { releaseFailure: null }]) {
    const f = fixture(options); await assert.rejects(f.run(), { code: 'schema_diagnostics_unavailable' });
  }
  const ended = fixture();
  await assert.rejects(withSchemaObservation({ createConnectionFn: ended.createConnectionFn }, async () => { ended.client.emit('end'); return 'untrusted result'; }), { code: 'schema_observation_unavailable' });
  assert.deepEqual(ended.releases, [true]);
});

test('private query failures and stale packaged contracts yield bounded unavailable errors before any repair', async () => {
  const f = fixture({ queryFailure: new Error('SELECT private credentials secret') });
  await assert.rejects(f.run(), error => { assert.equal(error.code, 'schema_diagnostics_unavailable'); assert.doesNotMatch(error.message, /private|credentials|SELECT/u); return true; });
  const cold = fixture();
  await assert.rejects(inspectDatabaseSchemaDrift({ createConnectionFn: cold.createConnectionFn, loadSchemaAnchorContractFn: async () => { throw null; } }), { code: 'schema_diagnostics_unavailable' });
  assert.equal(cold.calls.length, 0); assert.equal(cold.releases.length, 0);
});

test('failed BEGIN discards without querying facts or rolling back an unacknowledged start', async () => {
  const original = new Error('private BEGIN failure'), f = fixture({ beginFailure: original });
  await assert.rejects(withSchemaObservation({ createConnectionFn: f.createConnectionFn }, async () => assert.fail('work entered')), error => error === original);
  assert.deepEqual(f.releases, [true]); assert.equal(f.calls.some(row => row.sql === 'ROLLBACK'), false);
});
