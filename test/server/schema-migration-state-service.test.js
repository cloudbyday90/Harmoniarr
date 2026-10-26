import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDatabaseMigrationStateCurrent,
  buildDatabaseMigrationStateReport,
  formatDatabaseMigrationStateDiagnostics,
  inspectDatabaseMigrationState,
} from '../../src/server/schema-migration-state-service.js';

const repoMigrations = [
  {
    checksum: 'checksum-1',
    filename: '20260427_000001_bootstrap_core_tables.sql',
    migrationKey: '20260427_000001',
  },
  {
    checksum: 'checksum-2',
    filename: '20260428_000001_artwork_asset_foundation.sql',
    migrationKey: '20260428_000001',
  },
];

function buildFakePool(rows) {
  const calls = [];

  return {
    calls,
    pool: {
      connect: async () => ({
        query: async (sql) => {
          calls.push(sql);
          if (/SELECT filename, checksum, status, migration_key, error_message/.test(sql)) {
            return { rows };
          }

          return { rows: [] };
        },
        release: () => {
          calls.push('release');
        },
      }),
    },
  };
}

test('buildDatabaseMigrationStateReport treats matching applied rows as current', () => {
  const report = buildDatabaseMigrationStateReport({
    databaseRows: [
      {
        checksum: 'checksum-1',
        filename: '20260427_000001_bootstrap_core_tables.sql',
        migration_key: '20260427_000001',
        status: 'applied',
      },
      {
        checksum: 'checksum-2',
        filename: '20260428_000001_artwork_asset_foundation.sql',
        migration_key: '20260428_000001',
        status: 'applied',
      },
    ],
    repoMigrations,
  });

  assert.equal(report.current, true);
  assert.equal(report.appliedCount, 2);
  assert.deepEqual(report.pending, []);
  assert.deepEqual(report.unknownApplied, []);
  assert.deepEqual(report.checksumDrift, []);
  assert.deepEqual(report.nonAppliedRows, []);
});

test('buildDatabaseMigrationStateReport reports pending, unknown, drift, and failed migration state', () => {
  const report = buildDatabaseMigrationStateReport({
    databaseRows: [
      {
        checksum: 'different',
        filename: '20260427_000001_bootstrap_core_tables.sql',
        migration_key: '20260427_000001',
        status: 'applied',
      },
      {
        checksum: 'unknown-checksum',
        filename: '20260101_000001_removed.sql',
        migration_key: '20260101_000001',
        status: 'applied',
      },
      {
        checksum: 'checksum-2',
        error_message: 'boom',
        filename: '20260428_000001_artwork_asset_foundation.sql',
        migration_key: '20260428_000001',
        status: 'failed',
      },
    ],
    repoMigrations,
  });

  assert.equal(report.current, false);
  assert.deepEqual(report.pending, ['20260428_000001_artwork_asset_foundation.sql']);
  assert.deepEqual(report.unknownApplied, ['20260101_000001_removed.sql']);
  assert.deepEqual(report.checksumDrift, [{
    currentChecksum: 'checksum-1',
    filename: '20260427_000001_bootstrap_core_tables.sql',
    storedChecksum: 'different',
  }]);
  assert.equal(report.nonAppliedRows.length, 1);

  const diagnostics = formatDatabaseMigrationStateDiagnostics(report);
  assert.match(diagnostics, /Migration state: not current/);
  assert.match(diagnostics, /Pending repo migrations: 20260428_000001_artwork_asset_foundation\.sql/);
  assert.match(diagnostics, /Applied migrations missing from repo: 20260101_000001_removed\.sql/);
  assert.match(diagnostics, /Checksum drift: 20260427_000001_bootstrap_core_tables\.sql/);
  assert.match(diagnostics, /Non-applied migration rows: 20260428_000001_artwork_asset_foundation\.sql \(failed: boom\)/);
});

test('inspectDatabaseMigrationState reads rows from schema_migrations and releases the client', async () => {
  const { calls, pool } = buildFakePool([
    {
      checksum: 'checksum-1',
      filename: '20260427_000001_bootstrap_core_tables.sql',
      migration_key: '20260427_000001',
      status: 'applied',
    },
    {
      checksum: 'checksum-2',
      filename: '20260428_000001_artwork_asset_foundation.sql',
      migration_key: '20260428_000001',
      status: 'applied',
    },
  ]);

  const report = await inspectDatabaseMigrationState({
    getPoolFn: () => pool,
    loadMigrationManifestFn: async () => repoMigrations,
  });

  assert.equal(report.current, true);
  assert.equal(calls.at(-1), 'release');
});

test('assertDatabaseMigrationStateCurrent rejects stale database state with remediation guidance', async () => {
  const { pool } = buildFakePool([
    {
      checksum: 'checksum-1',
      filename: '20260427_000001_bootstrap_core_tables.sql',
      migration_key: '20260427_000001',
      status: 'applied',
    },
  ]);

  await assert.rejects(
    () => assertDatabaseMigrationStateCurrent({
      getPoolFn: () => pool,
      loadMigrationManifestFn: async () => repoMigrations,
    }),
    /Database migration state is not current\.[\s\S]*Run npm run migrate/,
  );
});

test('migration key mismatch is inconsistent even when filename, checksum and applied status match', () => {
  for (const migrationKey of ['20990101_000001', null]) {
    const report = buildDatabaseMigrationStateReport({ repoMigrations: [repoMigrations[0]], databaseRows: [{
      filename: repoMigrations[0].filename, checksum: repoMigrations[0].checksum, status: 'applied', migration_key: migrationKey,
    }] });
    assert.equal(report.current, false);
    assert.deepEqual(report.migrationKeyDrift, [{ filename: repoMigrations[0].filename,
      currentMigrationKey: repoMigrations[0].migrationKey, storedMigrationKey: migrationKey }]);
    assert.match(formatDatabaseMigrationStateDiagnostics(report), /1 migration key drift/u);
  }
});
