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
  },
  {
    checksum: 'checksum-2',
    filename: '20260428_000001_artwork_asset_foundation.sql',
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
        status: 'applied',
      },
      {
        checksum: 'checksum-2',
        filename: '20260428_000001_artwork_asset_foundation.sql',
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
        status: 'applied',
      },
      {
        checksum: 'unknown-checksum',
        filename: '20260101_000001_removed.sql',
        status: 'applied',
      },
      {
        checksum: 'checksum-2',
        error_message: 'boom',
        filename: '20260428_000001_artwork_asset_foundation.sql',
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
      status: 'applied',
    },
    {
      checksum: 'checksum-2',
      filename: '20260428_000001_artwork_asset_foundation.sql',
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
