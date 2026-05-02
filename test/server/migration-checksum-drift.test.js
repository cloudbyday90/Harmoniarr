import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoMigrationChecksumDrift, verifyAppliedMigrationChecksums } from '../../src/server/migrations.js';

function buildFakePool(rows) {
  return {
    connect: async () => ({
      query: async (sql) => {
        if (/CREATE TABLE IF NOT EXISTS/.test(sql) || /CREATE EXTENSION/.test(sql) || /CREATE OR REPLACE FUNCTION/.test(sql)) {
          return { rows: [] };
        }

        if (/SELECT filename, checksum/.test(sql)) {
          return { rows };
        }

        return { rows: [] };
      },
      release: () => {},
    }),
  };
}

test('verifyAppliedMigrationChecksums returns clean result when all checksums match', async () => {
  const rows = [
    { filename: '20260427_000001_bootstrap_core_tables.sql', checksum: null },
  ];

  // Pre-compute the actual checksum for the real migration file using the manifest.
  const { readMigrationFile } = await import('../../src/server/migration-manifest.js');
  const real = await readMigrationFile('20260427_000001_bootstrap_core_tables.sql');
  rows[0].checksum = real.checksum;

  const result = await verifyAppliedMigrationChecksums({
    getPoolFn: () => buildFakePool(rows),
  });

  assert.equal(result.clean, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.checkedCount, 1);
});

test('verifyAppliedMigrationChecksums detects checksum_mismatch when stored digest differs from current file', async () => {
  const rows = [
    { filename: '20260427_000001_bootstrap_core_tables.sql', checksum: 'aaaa0000bbbb' },
  ];

  const result = await verifyAppliedMigrationChecksums({
    getPoolFn: () => buildFakePool(rows),
  });

  assert.equal(result.clean, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].status, 'checksum_mismatch');
  assert.equal(result.violations[0].filename, '20260427_000001_bootstrap_core_tables.sql');
  assert.equal(result.violations[0].storedChecksum, 'aaaa0000bbbb');
  assert.ok(result.violations[0].currentChecksum, 'currentChecksum should be populated');
});

test('verifyAppliedMigrationChecksums detects file_missing for nonexistent applied migrations', async () => {
  const rows = [
    { filename: '20260101_000001_phantom_migration.sql', checksum: 'deadbeef' },
  ];

  const result = await verifyAppliedMigrationChecksums({
    getPoolFn: () => buildFakePool(rows),
  });

  assert.equal(result.clean, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].status, 'file_missing');
  assert.equal(result.violations[0].currentChecksum, null);
});

test('verifyAppliedMigrationChecksums returns clean when no migrations are applied', async () => {
  const result = await verifyAppliedMigrationChecksums({
    getPoolFn: () => buildFakePool([]),
  });

  assert.equal(result.clean, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.checkedCount, 0);
});

test('assertNoMigrationChecksumDrift resolves when all checksums are clean', async () => {
  const { readMigrationFile } = await import('../../src/server/migration-manifest.js');
  const real = await readMigrationFile('20260427_000001_bootstrap_core_tables.sql');

  const rows = [{ filename: '20260427_000001_bootstrap_core_tables.sql', checksum: real.checksum }];
  const result = await assertNoMigrationChecksumDrift({
    getPoolFn: () => buildFakePool(rows),
  });

  assert.equal(result.clean, true);
  assert.equal(result.violations.length, 0);
});

test('assertNoMigrationChecksumDrift throws when drift is detected', async () => {
  const rows = [{ filename: '20260427_000001_bootstrap_core_tables.sql', checksum: 'mismatch' }];

  await assert.rejects(
    async () => assertNoMigrationChecksumDrift({ getPoolFn: () => buildFakePool(rows) }),
    (error) => {
      assert.match(error.message, /Migration checksum drift detected/);
      assert.match(error.message, /20260427_000001_bootstrap_core_tables\.sql/);
      assert.match(error.message, /checksum_mismatch/);
      return true;
    },
  );
});
