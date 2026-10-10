/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { checksumSql, parseMigrationFilename } from '../../src/server/migration-manifest.js';
import { buildDatabaseMigrationStateReport } from '../../src/server/schema-migration-state-service.js';
import { prepareMigrationTemplateDatabase } from '../../testing/integration/migration-template-preparation.js';

const inputs = () => {
  const sql = 'SELECT 1;'; const entry = { ...parseMigrationFilename('20261010_000000_fixture.sql'), sql, checksum: checksumSql(sql) };
  return { sourceFingerprint: 'a'.repeat(64), manifest: [entry] };
};
const databaseRows = (manifest) => manifest.map((entry) => ({ filename: entry.filename, checksum: entry.checksum,
  migration_key: entry.migrationKey, status: 'applied', error_message: null }));
const report = (manifest, rows = databaseRows(manifest)) => buildDatabaseMigrationStateReport({ repoMigrations: manifest, databaseRows: rows });

test('preparation explicitly binds both migration owners to its pool and verifies the captured complete lineage', async () => {
  const source = inputs(); const pool = { owned: true }; const getPoolFn = () => pool; const order = [];
  const result = await prepareMigrationTemplateDatabase({ inputs: source, getPoolFn,
    applyPendingMigrationsFn: async (options) => { assert.equal(options.getPoolFn, getPoolFn); assert.equal(options.getPoolFn(), pool);
      order.push('applied'); return source.manifest.map((entry) => entry.filename); },
    assertDatabaseMigrationStateCurrentFn: async (options) => {
      assert.equal(options.getPoolFn, getPoolFn); assert.equal(options.getPoolFn(), pool);
      const captured = await options.loadMigrationManifestFn(); assert.deepEqual(captured, source.manifest);
      order.push('verified'); return report(captured);
    },
  });
  assert.deepEqual(order, ['applied', 'verified']); assert.equal(result.migrationCount, 1);
  assert.deepEqual(result.appliedMigrations, [source.manifest[0].filename]); assert.equal(result.databaseState.current, true);
});

test('caller mutation during migration application cannot change the lineage supplied to verification', async () => {
  const source = inputs(); const original = structuredClone(source.manifest);
  const result = await prepareMigrationTemplateDatabase({ inputs: source, getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => { source.manifest[0].migrationKey = 'changed'; source.manifest.length = 0; return []; },
    assertDatabaseMigrationStateCurrentFn: async ({ loadMigrationManifestFn }) => {
      const captured = await loadMigrationManifestFn(); assert.deepEqual(captured, original);
      assert.equal(Object.isFrozen(captured), true); return report(captured);
    },
  });
  assert.equal(result.migrationCount, 1);
});

test('a wrong migration key is refused even when the existing migration report calls the ledger current', async () => {
  const source = inputs(); const rows = databaseRows(source.manifest); rows[0].migration_key = '20261010_999999';
  const current = report(source.manifest, rows); assert.equal(current.current, true);
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: source, getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => [], assertDatabaseMigrationStateCurrentFn: async () => current,
  }), { code: 'migration_template_preparation_incomplete' });
});

test('missing, duplicate, unknown, non-applied and checksum-drifted ledger rows cannot certify preparation', async () => {
  const source = inputs(); const valid = databaseRows(source.manifest);
  const variants = [[], [valid[0], valid[0]], [{ ...valid[0], filename: '20261010_000001_unknown.sql' }],
    [{ ...valid[0], status: 'running' }], [{ ...valid[0], checksum: 'b'.repeat(64) }]];
  for (const rows of variants) await assert.rejects(prepareMigrationTemplateDatabase({ inputs: source, getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => [], assertDatabaseMigrationStateCurrentFn: async () => report(source.manifest, rows),
  }), { code: 'migration_template_preparation_incomplete' });
});

test('a forged current flag without complete counts and findings is refused', async () => {
  const source = inputs(); const valid = report(source.manifest);
  const variants = [{ current: true }, { ...valid, appliedCount: 0 }, { ...valid, pending: undefined },
    { ...valid, checksumDrift: [{}] }, { ...valid, appliedRows: [] }];
  for (const value of variants) await assert.rejects(prepareMigrationTemplateDatabase({ inputs: source, getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => [], assertDatabaseMigrationStateCurrentFn: async () => value,
  }), { code: 'migration_template_preparation_incomplete' });
});

test('migration application failure preserves its identity and never invokes verification', async () => {
  const failure = new Error('Controlled migration failure'); let verified = false;
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: inputs(), getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => { throw failure; },
    assertDatabaseMigrationStateCurrentFn: async () => { verified = true; },
  }), (error) => error === failure);
  assert.equal(verified, false);
});

test('verification failure preserves its original identity without returning a preparation result', async () => {
  const failure = new Error('Controlled verification failure');
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: inputs(), getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => [], assertDatabaseMigrationStateCurrentFn: async () => { throw failure; },
  }), (error) => error === failure);
});

test('invalid inputs or owner functions fail before any migration application', async () => {
  let applied = 0;
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: { ...inputs(), mode: 'snapshot' }, getPoolFn: () => ({}),
    applyPendingMigrationsFn: async () => { applied += 1; },
  }), TypeError);
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: inputs(), getPoolFn: null,
    applyPendingMigrationsFn: async () => { applied += 1; },
  }), TypeError);
  await assert.rejects(prepareMigrationTemplateDatabase({ inputs: inputs(), getPoolFn: () => ({}), mode: 'snapshot',
    applyPendingMigrationsFn: async () => { applied += 1; },
  }), TypeError);
  assert.equal(applied, 0);
});

test('unknown, duplicate and malformed application receipts cannot certify a lineage', async () => {
  const source = inputs(); let verified = 0;
  for (const receipt of [undefined, ['20261010_000001_unknown.sql'], [source.manifest[0].filename, source.manifest[0].filename]]) {
    await assert.rejects(prepareMigrationTemplateDatabase({ inputs: source, getPoolFn: () => ({}),
      applyPendingMigrationsFn: async () => receipt,
      assertDatabaseMigrationStateCurrentFn: async () => { verified += 1; return report(source.manifest); },
    }), { code: 'migration_template_preparation_incomplete' });
  }
  assert.equal(verified, 0);
});
