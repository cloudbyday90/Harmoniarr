/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { loadMigrationManifest } from '../src/server/migration-manifest.js';
import {
  bootstrapDatabaseSchemaFromSnapshot,
  defaultSchemaSnapshotPath,
} from '../src/server/schema-bootstrap.js';
import { getAppliedMigrationFilenames } from '../src/server/schema-migration-store.js';
import { withDockerizedPostgresDatabase } from '../testing/postgres-docker-database.js';

export async function validateSchemaBootstrap({
  bootstrapSchemaFn = bootstrapDatabaseSchemaFromSnapshot,
  getAppliedMigrationFilenamesFn = getAppliedMigrationFilenames,
  loadMigrationManifestFn = loadMigrationManifest,
  schemaSnapshotPath = defaultSchemaSnapshotPath,
  withDockerizedPostgresDatabaseFn = withDockerizedPostgresDatabase,
  withTemporaryPostgresDatabaseFn = null,
} = {}) {
  const migrations = await loadMigrationManifestFn();
  const withDatabaseFn = withTemporaryPostgresDatabaseFn ?? withDockerizedPostgresDatabaseFn;

  return withDatabaseFn({
    run: async ({ databaseName, getPoolFn }) => {
      const bootstrapResult = await bootstrapSchemaFn({
        getPoolFn,
        schemaSnapshotPath,
      });

      if (!bootstrapResult.bootstrapped) {
        throw new Error(`Schema snapshot bootstrap did not run for temporary database ${databaseName}`);
      }

      const pool = getPoolFn();
      const client = await pool.connect();

      try {
        const applied = await getAppliedMigrationFilenamesFn(client);
        const pending = migrations
          .filter((migration) => !applied.has(migration.filename))
          .map((migration) => migration.filename);

        if (pending.length > 0) {
          throw new Error(`Schema snapshot bootstrap left pending migrations: ${pending.join(', ')}`);
        }

        return {
          appliedCount: applied.size,
          databaseName,
          migrationCount: migrations.length,
          schemaSnapshotPath,
        };
      } finally {
        client.release();
      }
    },
  });
}
