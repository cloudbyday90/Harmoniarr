/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { assertSchemaAnchorContract, schemaAnchorProvenance, renderSchemaAnchorContract } from '../../src/server/schema-anchor-contract-policy.js';
import { loadSchemaAnchorContract, assertSnapshotSchemaAnchors } from '../../src/server/schema-anchor-contract-service.js';
import { inspectSchemaAnchorCatalog } from '../../src/server/schema-anchor-catalog-service.js';
import { readSchemaAnchorCatalog } from '../../src/server/schema-anchor-catalog-store.js';

const snapshotSql = await readFile(new URL('../../src/server/schema-snapshot.sql', import.meta.url), 'utf8');
const repoMigrations = await loadMigrationManifest();
const contract = await loadSchemaAnchorContract({ snapshotSql, repoMigrations });

test('packaged anchor contract is complete, canonical and bound to raw snapshot, lineage and specifications', async () => {
  assert.equal(Object.values(contract.anchors).reduce((n, group) => n + Object.keys(group).length, 0), 164);
  assert.equal(await readFile(new URL('../../src/server/schema-anchor-contract.json', import.meta.url), 'utf8'), renderSchemaAnchorContract(contract));
  for (const mutation of [
    { snapshotSql: snapshotSql + ' ' },
    { repoMigrations: repoMigrations.slice(0, -1) },
    { repoMigrations: repoMigrations.map((row, i) => i === 0 ? { ...row, checksum: 'changed' } : row) },
  ]) await assert.rejects(loadSchemaAnchorContract({ snapshotSql, repoMigrations, ...mutation }), { code: 'snapshot_anchor_contract_invalid' });
});

test('missing, malformed, truncated or unsafe expected facts cannot authorize bootstrap', async () => {
  for (const readFileFn of [async () => '{', async () => { throw null; }]) {
    await assert.rejects(loadSchemaAnchorContract({ snapshotSql, repoMigrations, readFileFn }), { code: 'snapshot_anchor_contract_invalid' });
  }
  const mutations = [
    value => { value.provenance.format++; }, value => { value.provenance.postgresMajor++; },
    value => { value.provenance.specificationsSha256 = 'wrong'; },
    value => { delete value.anchors.tables; }, value => { value.anchors.tables = {}; },
    value => { value.anchors.tables['table.operation_runs'] = null; },
    value => { value.anchors.constraints['constraint.operation_runs.operation_runs_pkey'].validated = false; },
    value => { value.anchors.constraints['constraint.operation_runs.operation_runs_pkey'].enforced = false; },
    ...['valid', 'ready', 'live'].map(flag => value => { value.anchors.indexes['index.admin_recovery_runs_one_armed_idx'][flag] = false; }),
    value => { value.anchors.triggers['trigger.app_users.app_users_root_authority_admission'].enabled = 'D'; },
    value => { value.anchors.triggers['trigger.app_users.app_users_root_authority_admission'].functionDefinition = ''; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(contract); mutate(value);
    assert.throws(() => assertSchemaAnchorContract(value, schemaAnchorProvenance({ snapshotSql, repoMigrations })), { code: 'snapshot_anchor_contract_invalid' });
  }
});

function catalogFixture({ mutate, original, restoreFailure, version = 180006 } = {}) {
  const calls = [], actual = structuredClone(contract.anchors); let groupIndex = 0;
  if (mutate) mutate(actual);
  const client = { getTransactionStatus: () => 'T', async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('current_setting')) return { rows: [{ search_path: '"$user", public', version }] };
    if (sql.includes('set_config')) {
      if (values[0] !== 'pg_catalog' && restoreFailure) throw restoreFailure;
      return { rows: [] };
    }
    if (original !== undefined) throw original;
    const group = ['tables', 'columns', 'constraints', 'indexes', 'triggers'][groupIndex++];
    return { rows: JSON.parse(values[0]).map(({ key }) => ({ key, actual: actual[group][key] ?? null })) };
  } };
  return { client, calls };
}

test('canonical catalog reads are five sequential parameterized batches and restore the owned local search path', async () => {
  const f = catalogFixture(); await assertSnapshotSchemaAnchors({ client: f.client, contract });
  assert.equal(f.calls.length, 8);
  assert.deepEqual(f.calls[1].values, ['pg_catalog']); assert.deepEqual(f.calls.at(-1).values, ['"$user", public']);
  for (const { sql, values } of f.calls.slice(2, -1)) {
    assert.match(sql, /pg_catalog\.jsonb_to_recordset\(\$1::jsonb\)/u); assert.ok(JSON.parse(values[0]).length > 0);
  }
  await assert.rejects(inspectSchemaAnchorCatalog({ getTransactionStatus: () => 'I' }), /active owned transaction/u);
  const older = catalogFixture({ version: 170000 });
  await assert.rejects(inspectSchemaAnchorCatalog(older.client), { code: 'snapshot_anchor_postgres_unsupported' });
  assert.equal(older.calls.length, 1);
});

test('missing objects, same-name weakening and literal whitespace changes fail with bounded names-only diagnostics', async () => {
  for (const mutate of [
    actual => { actual.tables['table.operation_runs'] = null; },
    actual => { actual.constraints['constraint.operation_runs.operation_runs_pkey'].definition = 'CHECK (true)'; },
    actual => { actual.indexes['index.admin_recovery_runs_one_armed_idx'].valid = false; },
    actual => {
      const trigger = actual.triggers['trigger.app_users.app_users_root_authority_admission'];
      const before = trigger.functionDefinition;
      trigger.functionDefinition = before.replace(/'([^']*)'/u, (_match, literal) => "'" + literal + "  '");
      assert.notEqual(trigger.functionDefinition, before);
    },
  ]) {
    const f = catalogFixture({ mutate });
    await assert.rejects(assertSnapshotSchemaAnchors({ client: f.client, contract }), error => {
      assert.equal(error.code, 'snapshot_schema_anchors_invalid'); assert.equal(error.anchors.length, 1);
      assert.ok(error.message.length < 150); assert.equal(error.message.includes('CHECK'), false); return true;
    });
    assert.deepEqual(f.calls.at(-1).values, ['"$user", public']);
  }
});

test('catalog rejection Error or null survives restoration failure and successful reads reject failed restoration', async () => {
  for (const original of [new Error('catalog read failed'), null]) {
    const f = catalogFixture({ original, restoreFailure: new Error('restore failed') });
    await assert.rejects(inspectSchemaAnchorCatalog(f.client), error => error === original);
  }
  const failure = new Error('restore failed'), f = catalogFixture({ restoreFailure: failure });
  await assert.rejects(inspectSchemaAnchorCatalog(f.client), error => error === failure);
});

test('incomplete, duplicate or unsolicited catalog observations refuse instead of silently overwriting facts', async () => {
  const entry = { key: 'table.operation_runs', name: 'operation_runs' };
  for (const rows of [[], [{ key: entry.key }, { key: entry.key }], [{ key: 'table.other' }]]) {
    await assert.rejects(readSchemaAnchorCatalog({ query: async () => ({ rows }) }, { tables: [entry] }), { code: 'snapshot_anchor_catalog_invalid' });
  }
});
